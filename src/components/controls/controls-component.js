/* eslint-disable no-unused-vars */
import React, { Component } from "react";
import { LiveButtonComponent } from "../controls/live-button-model/liveButton-component";
import { PlayPauseButtonComponent } from "./play-pause/play-pause-component";
import { SpeedControlComponent } from "./speed-control/speed-control-component";
import { sliderModel } from "./slider/slider-model";
import { dateTimeModel } from "../controls/date-time-model";
import { liveButtonModel } from "../controls/live-button-model";
import { pausePlayModel } from "./play-pause/play-pause-model";
import { playBackSpeedModel } from "./speed-control/playback-speed";

export class ControlsView extends React.Component {
   componentDidMount() {
      playBackSpeedModel.initPlayBackSpeed();
      pausePlayModel.initPausePlay();
      sliderModel.initSlider();
      dateTimeModel.initDateTimeInput();
      liveButtonModel.initLiveButton();
   }

   render() {
      return (
         //Control bar at the bottom of the map
         <React.Fragment>
            <div id="RTM-ControlBarContainer">
               <div id="Slider-Container">
                  <div id="RTM-TimeSlider" className="pmd-range-slider"></div>
               </div>
               <div id="RTM-ControlsContainer">
                  <div id="timeControls">
                     <PlayPauseButtonComponent />
                     <SpeedControlComponent />
                  </div>

                  <div className="inputControls">
                     <label for="dateInputBox"> Date: </label>
                     <input
                        className="timeInputBox mdc-button"
                        type="date"
                        id="dateInputBox"
                        step="1"
                     ></input>
                     <button
                        className="apply-changes-btn"
                        data-input-name="dateInputBox"
                        data-tip="Click to Apply Changes"
                        data-for="splTooltip"
                     >Apply</button>
                  </div>

                  <div className="inputControls">
                     <label for="timeRangeStart"> Start Time: </label>
                     <input
                        className="timeInputBox mdc-button"
                        type="time"
                        id="timeRangeStart"
                        step="1"
                        data-tip="In Popup, please hit ENTER to apply your time change"
                        data-for="splTooltip"
                     ></input>
                     <button
                        className="apply-changes-btn"
                        data-input-name="timeRangeStart"
                        data-tip="Click to Apply Changes"
                        data-for="splTooltip"
                     >Apply</button>
                  </div>

                  <div className="inputControls">
                     <label for="currentTimeInput"> Current Time: </label>
                     <input
                        className="timeInputBox mdc-button"
                        type="time"
                        id="currentTimeInput"
                        step="1"
                        data-tip="In Popup, please hit ENTER to apply your time change"
                        data-for="splTooltip"
                     ></input>
                     <button
                        className="apply-changes-btn"
                        data-input-name="currentTimeInput"
                        data-tip="Click to Apply Changes"
                        data-for="splTooltip"
                     >Apply</button>
                  </div>
                  {/* //Jump to live time. */}
                  <LiveButtonComponent />
               </div>
               <div className="disableScreen"></div>
            </div>
         </React.Fragment>
      );
   }
}
