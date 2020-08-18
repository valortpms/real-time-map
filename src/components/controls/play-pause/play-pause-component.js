import React, { Component } from "react";
import { pausePlayModel } from "./play-pause-model";
import splStyles from "../../../spartanlync/styles/spl-styles";

export const PlayPauseButtonComponent = () => (
   <button
      className="mdc-button"
      id="RTMControlButton"
      onClick={() => pausePlayModel.togglePausePlay()}
      style={splStyles.playBtnStyle}
      data-tip="Pause"
      data-for="splTooltip"
   >
   </button>
);