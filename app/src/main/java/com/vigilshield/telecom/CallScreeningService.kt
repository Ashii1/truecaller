package com.vigilshield.telecom

import android.telecom.Call
import android.telecom.CallScreeningService

/** Native screening endpoint; never blocks a call without an explicit rule. */
class CallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) {
        respondToCall(callDetails, CallResponse.Builder().setDisallowCall(false).build())
    }
}
