import layersModel from "../../components/map/layers/layer-model";
import moment from "moment-timezone";
import { checkSameDay } from "../../utils/helper";
import { playBackSpeedModel } from "../../components/controls/speed-control/playback-speed";
import storage from "../../dataStore";
import {
   initHistoricalFeedRunner,
   initRealTimeFeedRunner
} from "../../services/data-feed/data-feed-getter";
import {
   resetMapData,
   markerList
} from "../../dataStore/map-data";

export function updateTimeChangeFunctions(newTime) {
   Object.values(markerList).forEach(marker => marker ? marker.timeChangedUpdate(newTime) : undefined);
}

export function updatePeriodChangeFunctions(newPeriod) {
   Object.values(markerList).forEach(marker => marker.periodChangedUpdate(newPeriod));
   playBackSpeedModel.updateSpeed(newPeriod);
}

export function setupTimeObjects(startTimeObj, rangeDiff = 0) {
   storage.startDate = startTimeObj;

   storage.isLiveDay = checkSameDay(storage.startDate, moment());

   storage.dayStart = storage.startDate.clone().startOf("day").unix();
   storage.dayEnd = storage.startDate.clone().endOf("day").unix();

   storage.currentTime = storage.startDate.unix();
   storage.timeRangeStart = storage.currentTime - rangeDiff;
}

export function differentDateSet(selectedTime) {

   layersModel.clearAllLayers();
   resetMapData();

   const rangeDiff = storage.currentTime - storage.timeRangeStart;
   setupTimeObjects(moment.unix(selectedTime), rangeDiff);
   storage.historicalComplete = false;
   storage.historicalDataArchive = null;

   if (storage.realTimeFeedDataGetter) {
      storage.realTimeFeedDataGetter.cancelRunner();
      delete storage.realTimeFeedDataGetter;
   }
   initRealTimeFeedRunner();

   if (storage.historicalFeedDataGetter) {
      storage.historicalFeedDataGetter.cancelRunner();
      delete storage.historicalFeedDataGetter;
   }
   initHistoricalFeedRunner();
}