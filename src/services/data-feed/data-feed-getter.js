import storage from "../../dataStore";
import moment from "moment-timezone";
import splSrv from "../../spartanlync/services";
import { makeAPIMultiCall } from "../api/helpers";
import { initPaths } from "../../components/map/paths";
import { resetTransitionAnimation, getDayPerentage } from "../../utils/helper";
import { configStorage } from "../../dataStore/database/config-storage";
import { markerList } from "../../dataStore/map-data";
import { processFeedData } from "./process-feed-data/process-feed-data";
import { apiConfig } from "../../dataStore/api-config";
import { showSnackBar } from "../../components/snackbar/snackbar";
import { progressBar } from "../../components/progress-bar/progress-indicator";
import { throttleTime } from "rxjs/operators";
import { pausePlayModel } from "../../components/controls/play-pause/play-pause-model";

export const feedDataGetter = {

   init(fromDate, feedTypes, resultsLimit = 60000, search) {
      this.fromDate = fromDate;
      this.feedTypes = feedTypes;
      this.resultsLimit = resultsLimit; //Maximum 50000
      this.lastFeedVersions = {};
      this.feedTypes.forEach(typeName =>
         this.lastFeedVersions[typeName] = undefined
      );
      this.search = search ? search : { fromDate };
   },

   removeFeedType(typeName) {
      this.feedTypes = this.feedTypes.filter(value =>
         value !== typeName
      );
   },

   addFeedType(typeName) {
      this.feedTypes.push(typeName);
   },

   getFeedData() {
      const multiCallList = this.createMultiCallList();

      return new Promise((resolve, reject) => {
         makeAPIMultiCall(multiCallList).then(result => {
            this.updateFeedVersions(result);
            resolve(result);
         });

         this.cancelRunner = () => {
            reject("Canceled");
         };
      });
   },

   updateFeedVersions(result) {
      // console.warn(53, result);
      result.forEach((value, i) => {
         const typeName = this.feedTypes[i];
         this.lastFeedVersions[typeName] = value.toVersion;
      });
   },

   createMultiCallList() {
      const APICalls = this.feedTypes.map(typeName => ["GetFeed",
         {
            "typeName": typeName,
            "fromVersion": this.lastFeedVersions[typeName],
            "resultsLimit": this.resultsLimit,
            "search": this.search
         }
      ]);
      return APICalls;
   },
};

export function initRealTimeFeedRunner() {

   storage.realTimeFeedDataGetter = { ...feedDataGetter };
   storage.realTimeFeedDataGetter.init(
      //Get data 10 min before actual start time for accurate display
      moment.unix(storage.dayStart - 600).utc().format(),
      apiConfig.feedTypesToGet,
      3600
   );

   realTimefeedRunner();

   if (!storage.isLiveDay) {
      return;
   }

   const getDataEvery6Seconds = storage.dateKeeper$.observable.pipe(
      throttleTime(6666)
   );

   getDataEvery6Seconds.subscribe(realTimefeedRunner);
}

export function realTimefeedRunner() {
   storage.realTimeDataForVehsFetched = {};
   storage.realTimeFeedDataGetter.getFeedData()
      .then(processFeedData)
      .catch(reason => console.warn("realTimefeedRunner Canceled.", reason))
      .finally(() => {
         // Report on vehicles processed
         if (Object.keys(storage.realTimeDataForVehsFetched).length) {
            const vehsProcessed = '"' + Object.values(storage.realTimeDataForVehsFetched).map(vehName => { return vehName; }).join('", "') + '"';
            console.log("---- Retrieved RealTime GPS data for Vehicle(s) [", vehsProcessed, "]");
            storage.historicalVehsFetched = {};
         }
      });
}

export function initHistoricalFeedRunner() {

   showSnackBar(splmap.tr("map_fetching_historical_data_inprogress"));
   progressBar.update(0.1);
   storage.historicalVehsFetched = {};

   configStorage.getItem("historicalFeedDataList").then(indexedDBVal => {

      const historicalFeedDataCache = getFeedDataCache(indexedDBVal);
      storage.historicalFeedDataGetter = { ...feedDataGetter };
      storage.historicalFeedDataGetter.init(
         moment.unix(historicalFeedDataCache.timeStamp).utc().format(),
         apiConfig.feedTypesToGet,
         apiConfig.resultsLimit
      );
      historicalFeedRunner(historicalFeedDataCache);
   });

}

export function getFeedDataCache(indexedDBVal = null) {

   if (indexedDBVal && timeWithinToday(indexedDBVal.timeStamp)) {

      const { timeStamp } = indexedDBVal;
      console.log("Retrieved historical data up to: " + moment.unix(timeStamp).format(storage.humanDateTimeFormat));
      progressBar.update(getDayPerentage(timeStamp));
      return indexedDBVal;
   }
   else {
      return createEmptyHistoricalFeedDataCache();
   }
}

export function createEmptyHistoricalFeedDataCache(timestamp) {
   const historicalFeedDataCache = apiConfig.feedTypesToGet.map(type => {
      return {
         data: [],
         type
      };
   });
   historicalFeedDataCache.timeStamp = typeof timestamp !== "undefined" ? timestamp : storage.dayStart;
   return historicalFeedDataCache;
}

export function timeWithinToday(time) {
   return storage.dayStart < time && time < storage.dayEnd;
}

export function historicalFeedRunner(historicalFeedDataList) {
   storage.historicalFeedDataGetter.getFeedData()
      .then(feedData => {
         feedData.forEach((element, index) => historicalFeedDataList[index].data = [
            ...historicalFeedDataList[index].data,
            ...element.data
         ]);

         const latestData = feedData[0].data;
         if (latestData.length > 0 && latestData[0].dateTime <= storage.dayEnd) { //keep getting historical data until up to date.

            const { length } = latestData;
            const { dateTime } = latestData[length - 1];

            const dayPerentage = getDayPerentage(dateTime);

            if (dayPerentage && dayPerentage < 1) {
               progressBar.update(dayPerentage);
            }

            historicalFeedRunner(historicalFeedDataList);
         }
         else {

            historicalFeedDataList.timeStamp = latestData.length ?
               Math.min(moment(latestData[0].dateTime).unix(), storage.dayEnd) :
               storage.startDate.unix();
            historicalFeedDataComplete(historicalFeedDataList);
         }
      })
      .catch(reason => {
         console.warn("historicalFeedDataGetter Canceled.", reason);

         // Execute post-historicalFeedData operations
         splSrv.events.exec("onLoadMapDataCompleted");
      });
}

export function historicalFeedDataComplete(historicalFeedDataList) {

   processFeedData(historicalFeedDataList);
   resetTransitionAnimation();

   delete storage.historicalFeedDataGetter;
   storage.historicalComplete = true;

   Object.values(markerList)
      .forEach(marker => {
         marker.veryifyDateTimeIndex();
         marker.initExceptions();
         initPaths(marker);
      });

   // Report on vehicles processed with Historical data
   if (Object.keys(storage.historicalVehsFetched).length) {
      const vehsProcessed = '"' + Object.values(storage.historicalVehsFetched).map(vehName => { return vehName; }).join('", "') + '"';
      console.log("---- Retrieved historical GPS data for Vehicle(s) [", vehsProcessed, "]");
      storage.historicalVehsFetched = {};
   }

   if (storage.isLiveDay && !storage.doNotSaveLiveHistoricalData) {
      storage.historicalDataArchive = null;
      configStorage.setItem("historicalFeedDataList", historicalFeedDataList).then(() => {
         console.log("Updated historical data saved!");

         // Ensure time-keeping operations continue to run, by restarting dateKeeper heartbeat if stopped
         if (pausePlayModel.playing && !storage.dateKeeper$.paused) {
            const momentInTime = storage.currentTime;
            setTimeout(function () {
               if (momentInTime === storage.currentTime) {
                  storage.dateKeeper$.resume();
               }
            }, 1000);
         }

         // Execute any SpartanLync Listeners waiting for this moment in the SplMap lifecycle
         splSrv.events.exec("onLoadMapDataCompleted");
      });
   }
   // Archive non-live historical data
   else {
      if (!storage.isLiveDay && !storage.historicalDataArchive) {
         console.log("Historical data from the past now Archived!");
         storage.historicalDataArchive = historicalFeedDataList;
      }

      // Execute post-historicalFeedData operations
      splSrv.events.exec("onLoadMapDataCompleted");
   }

   progressBar.update(1);
   showSnackBar(splmap.tr("map_fetching_historical_data_completed"));

   storage.dateKeeper$.update();
   resetTransitionAnimation();
}

export const fetchDataForVeh = {

   _historicalVehRetrievalQueue: [],
   _historicalFeedDataCache: null,

   getHistorical(vehId) {
      const me = this;

      if (!vehId) { return; }

      // If busy fetching, add Veh to fetch queue
      if (!me._historicalVehRetrievalQueue.includes(vehId)) {
         me._historicalVehRetrievalQueue.push(vehId);
      }
      // Queue up VehId requests and process them all at once
      setTimeout(function () {
         if (!storage.historicalFeedDataGetter && !me._historicalFeedDataCache && me._historicalVehRetrievalQueue.length) {
            me._processVehHistoricalQueue();
         }
      }, 100);
   },

   _processVehHistoricalQueue() {
      const me = this;
      const vehIdsToActivate = JSON.parse(JSON.stringify(me._historicalVehRetrievalQueue));

      me._historicalVehRetrievalQueue = [];
      storage.historicalFeedDataGetter = true;

      configStorage.getItem("historicalFeedDataList").then(indexedDBVal => {

         if (indexedDBVal && typeof indexedDBVal.timeStamp !== "undefined") {
            const { timeStamp } = indexedDBVal;

            console.log("Retrieved historical data up to:", moment.unix(timeStamp).format(storage.humanDateTimeFormat), "for Vehicle(s) [", me._getVehNames(vehIdsToActivate), "]");
            showSnackBar(splmap.tr("map_fetching_historical_data_inprogress"));

            // Init
            storage.historicalFeedDataGetter = { ...feedDataGetter };
            storage.historicalFeedDataGetter.init(
               moment.unix(indexedDBVal.timeStamp).utc().format(),
               apiConfig.feedTypesToGet,
               apiConfig.resultsLimit
            );

            // Remove from historical data all vehicles except Vehicle(s) to create on Map, then process historical data
            if (indexedDBVal && timeWithinToday(indexedDBVal.timeStamp)) {
               me._historicalFeedDataCache = indexedDBVal;
               storage.doNotSaveLiveHistoricalData = true;
               historicalFeedRunner(me._pruneHistoricalFeedDataCache(vehIdsToActivate));
               splSrv.events.register("onLoadMapDataCompleted", () => {
                  delete storage.doNotSaveLiveHistoricalData;
               });
            }
            // On non-live date, defer processing until historical data is fetched
            else if (storage.historicalDataArchive) {
               me._historicalFeedDataCache = storage.historicalDataArchive;
               historicalFeedRunner(me._pruneHistoricalFeedDataCache(vehIdsToActivate));
            }
         }
      });

      if (me._historicalVehRetrievalQueue.length) {
         me._processVehHistoricalQueue();
      }
      else {
         splSrv.events.register("onLoadMapDataCompleted", () => {
            me._historicalFeedDataCache = null;
         });
      }
   },

   _pruneHistoricalFeedDataCache(vehIdsToActivate) {
      const me = this;

      if (!me._historicalFeedDataCache || !vehIdsToActivate.length) {
         return;
      }
      const newHistoricalFeedDataCache = createEmptyHistoricalFeedDataCache(me._historicalFeedDataCache.timeStamp);
      for (const feedTypeIdx in me._historicalFeedDataCache) {
         if (isNaN(feedTypeIdx)) { continue; }
         newHistoricalFeedDataCache[feedTypeIdx].data = me._historicalFeedDataCache[feedTypeIdx].data.filter(rec => {
            return typeof rec.device.id !== "undefined" && vehIdsToActivate.includes(rec.device.id) ? true : false;
         });
      }
      return newHistoricalFeedDataCache;
   },

   _getVehNames(vehIdsToActivate) {
      let vehNamesArr = [];
      if (Array.isArray(vehIdsToActivate)) {
         vehNamesArr = vehIdsToActivate.map(vehId => {
            return typeof storage.selectedDevices[vehId] !== "undefined" ? storage.selectedDevices[vehId].name : "";
         });
      }
      return '"' + vehNamesArr.join('", "') + '"';
   }
};
