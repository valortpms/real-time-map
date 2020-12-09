import storage from "../../../dataStore";
import { getExceptionColor } from "../../../utils/helper";
import {
   retrieveDeviceInfo,
   filterMarkerButton,
   getStrongText,
   escapeQuotes,
   getDefaultPopupText,
   closeAllTooltips
} from "./popup-helpers";

export function bindDeviceNamePopup(deviceID, polyline) {

   polyline.bindPopup(getDefaultPopupText(deviceID), {
      autoClose: false,
   }).on("popupopen", (evt) => {
      evt.popup.bringToFront();
      evt.popup._container.addEventListener("click", function () {
         evt.popup.bringToFront();
      });
   });

   polyline.on("popupopen", () => {
      retrieveDeviceInfo(deviceID).then(deviceData => {
         const { name } = deviceData;
         const cleanedName = escapeQuotes(name);
         const popupText = filterMarkerButton(deviceID, cleanedName) + getStrongText(cleanedName);
         polyline.setPopupContent(popupText);
      });
   });

   polyline.on("mouseover", (evt) => {
      polyline.unbindTooltip();
      closeAllTooltips();
      retrieveDeviceInfo(deviceID).then(deviceData => {
         const { name } = deviceData;
         const cleanedName = escapeQuotes(name);
         polyline.bindTooltip(cleanedName, {
            "className": "spl-map-vehicle-tooltip",
         }).openTooltip(evt.latlng);
      });
   });

}

export function bindExceptionPopUp(exceptionPolyLine) {

   const {
      deviceID,
      ruleID,
   } = exceptionPolyLine;

   exceptionPolyLine.bindPopup(getDefaultPopupText(deviceID));

   exceptionPolyLine.on("popupopen", () => {

      retrieveDeviceInfo(deviceID).then(deviceData => {

         const popupText = createExceptionPopUp(deviceID, deviceData, ruleID);
         exceptionPolyLine.setPopupContent(popupText);

      });
   });
}

function createExceptionPopUp(deviceID, deviceData, ruleID) {

   const popTextFactory = [];

   const { name } = deviceData;
   const cleanedName = escapeQuotes(name);
   popTextFactory.push(filterMarkerButton(deviceID, cleanedName));
   popTextFactory.push(getStrongText(cleanedName));

   if (storage.selectedExceptions.hasOwnProperty(ruleID)) {

      const {
         name,
      } = storage.selectedExceptions[ruleID];

      popTextFactory.push(`<p class="popupRuleName" style="border-top: 1px solid ${getExceptionColor(ruleID)}">`);
      popTextFactory.push(splmap.tr("sensor_search_rule_name_label") + `: ${name ? name : ruleID}`);
   }

   popTextFactory.push("</p>");
   return popTextFactory.filter(Boolean).join("");
}