import React, { Component } from "react";
import { liveButtonModel } from "./live-button-model";

export const LiveButtonComponent = () => (
   <button
      id="RTM-LiveButton"
      onClick={() => liveButtonModel.goToLive()}>
      <span className="go-live-help">( Click to revert back to LIVE )</span>
      <span id="RTM-LiveDot"></span>
    LIVE
   </button>
);