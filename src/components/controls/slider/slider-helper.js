import storage from "../../../dataStore";
import moment from "moment-timezone";

export const minutesInDay = 1439;

export function getMinuteOfDay(currentSecond) {
   return Math.floor((currentSecond - storage.dayStart) / 60);
}

export function calcCurrentTime(minuteOfDayRAW) {
   const minuteOfDay = Math.trunc(minuteOfDayRAW);
   return storage.dayStart + (minuteOfDay * 60);
}

export function getTimeInlocalFormat(minuteOfDay) {
   const currentTime = moment.unix(calcCurrentTime(minuteOfDay));
   return currentTime.format("h:mm A", { trim: false });
}

export function minuteOfDayToHour(minuteOfDayRAW) {
   const minuteOfDay = Math.trunc(minuteOfDayRAW);
   const meridiem = minuteOfDay < 720 ? "AM" : "PM";
   const displayTime = Math.ceil((minuteOfDay / 720) * 12);
   return `${displayTime <= 12 ? displayTime : displayTime - 12}:00 ${meridiem}`;
}

export function getPixelsPerMinute(widthPixels) {
   return widthPixels / 24 / 60;
}

export function calculateLeftOffset(offsetPixelWidth, currentValue, pixelsPerMinute) {

   const overFlowValue = Math.abs(Math.round(offsetPixelWidth / pixelsPerMinute));
   if (currentValue <= overFlowValue) {
      return Math.round((overFlowValue - currentValue) * pixelsPerMinute);
   }

   const upperOverFlowLimit = minutesInDay - overFlowValue;
   if (currentValue >= upperOverFlowLimit) {
      return Math.round((upperOverFlowLimit - currentValue) * pixelsPerMinute);
   }
   return 0;
}
