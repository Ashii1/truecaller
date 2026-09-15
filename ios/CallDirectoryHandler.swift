import Foundation
import CallKit

/**
 * VigilShield iOS Call Directory Extension (CallKit).
 * 
 * Complies with Apple CallKit requirements:
 * 1. Executes out-of-process in background under strict 5MB memory limit.
 * 2. Pre-sorts telephone numbers ascending before calling `addIdentificationEntry`.
 * 3. Supports incremental and full refresh cycles from local SQLite container.
 */
class CallDirectoryHandler: CXCallDirectoryProvider {

    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.delegate = self

        // Determine if incremental or full reload
        if context.isIncremental {
            addIncrementalBlockingEntries(to: context)
            addIncrementalIdentificationEntries(to: context)
        } else {
            addAllBlockingEntries(to: context)
            addAllIdentificationEntries(to: context)
        }

        context.completeRequest()
    }

    // MARK: - Blocking Entries (Spam / Scam Phone Numbers)
    private func addAllBlockingEntries(to context: CXCallDirectoryExtensionContext) {
        // Numbers MUST be sorted in numerically ascending order
        let blockedPhoneNumbers: [CXCallDirectoryPhoneNumber] = LocalDatabaseManager.shared.fetchSortedBlockedNumbers()

        for phoneNumber in blockedPhoneNumbers {
            context.addBlockingEntry(withNextSequentialPhoneNumber: phoneNumber)
        }
    }

    private func addIncrementalBlockingEntries(to context: CXCallDirectoryExtensionContext) {
        let (added, removed) = LocalDatabaseManager.shared.fetchIncrementalBlockedNumbers()

        for phoneNumber in removed {
            context.removeBlockingEntry(withPhoneNumber: phoneNumber)
        }

        for phoneNumber in added {
            context.addBlockingEntry(withNextSequentialPhoneNumber: phoneNumber)
        }
    }

    // MARK: - Identification Entries (Caller Names & Verified Badges)
    private func addAllIdentificationEntries(to context: CXCallDirectoryExtensionContext) {
        // Pairs MUST be sorted in numerically ascending order by phone number
        let callerIdentifications: [(CXCallDirectoryPhoneNumber, String)] = LocalDatabaseManager.shared.fetchSortedIdentifications()

        for (phoneNumber, label) in callerIdentifications {
            context.addIdentificationEntry(withNextSequentialPhoneNumber: phoneNumber, label: label)
        }
    }

    private func addIncrementalIdentificationEntries(to context: CXCallDirectoryExtensionContext) {
        let (added, removed) = LocalDatabaseManager.shared.fetchIncrementalIdentifications()

        for phoneNumber in removed {
            context.removeIdentificationEntry(withPhoneNumber: phoneNumber)
        }

        for (phoneNumber, label) in added {
            context.addIdentificationEntry(withNextSequentialPhoneNumber: phoneNumber, label: label)
        }
    }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
        // Log telemetry locally for crash/memory diagnostic
        NSLog("[VigilShield] CallDirectoryHandler request failed: %@", error.localizedDescription)
    }
}
