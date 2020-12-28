import ReactTooltip from "react-tooltip";
import React, { useEffect } from "react";
import storage from "../../../dataStore";

export const SpeedControlComponent = () => {

   useEffect(() => {

      // Clear Tooltip when user navigates from ControlPanel to Map
      storage.map.on("click", () => ReactTooltip.hide());

      // Clear Tooltip when user clicks Speed Dropdown option
      document.getElementsByClassName("mdc-select__native-control")[0].addEventListener("click", () => ReactTooltip.hide());

   }, []);

   return (
      <div className="inputControls speed">
         <div id="speedLabel">
            <label className="mdc-floating-label">Speed:</label>
         </div>
         <div className="mdc-select" id="SpeedControlDropUp" data-tip="Playback Speed Menu (Speed cannot be changed when Live)" data-for="splTooltip">
            <select className="mdc-select__native-control" defaultValue={"1"}>
               <option value="10">10x</option>
               <option value="5">5x</option>
               <option value="3">3x</option>
               <option value="2">2x</option>
               <option value="1">1x</option>
            </select>
         </div>
      </div>
   );
};
