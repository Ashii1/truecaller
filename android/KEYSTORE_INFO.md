# Android release signing

Release signing credentials are intentionally not stored in this repository.

## CI configuration

Configure these GitHub Actions repository secrets:

- `VIGILSHIELD_KEYSTORE_BASE64`
- `VIGILSHIELD_KEYSTORE_PASSWORD`
- `VIGILSHIELD_KEY_ALIAS`
- `VIGILSHIELD_KEY_PASSWORD`

The workflow reconstructs the keystore only in the runner temporary directory and passes the credentials to Gradle through environment variables.

## Security note

Previous repository revisions contained a release keystore and its credentials. Those credentials must be treated as compromised and must not be reused for a production signing key.

Because Android updates require the same signing identity, migrate users deliberately if the exposed certificate was already distributed. For new production distribution, generate a new private release key, store it only in a protected secret-management system, and update the CI secrets before publishing.
