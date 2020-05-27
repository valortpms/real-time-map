import React, { Component } from "react";
import { pausePlayModel } from "./play-pause-model";
import splStyles from "../../../spartanlync/styles/spl-styles";

export const PlayPauseButtonComponent = () => (
   <button
      className="mdc-button"
      id="RTMControlButton"
      onClick={() => pausePlayModel.togglePausePlay()}
      style={splStyles.playBtnStyle}
      title="Pause"
   >
   </button>
);