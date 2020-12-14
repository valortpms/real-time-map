import storage from "../../../dataStore";
import moment from "moment-timezone";
import splSrv from "../../../spartanlync/services";
import { logRecordsData } from "../../../dataStore/map-data";
import { createObjectKeyIfNotExist, insertIntoOrderedArray } from "../../../utils/helper";
import { createDeviceMarker } from "../../../components/map/markers/marker-model";

export function processLogRecords(data) {
   data.map(processDeviceData)
      .filter(isVehSelected) // If vehicle is not selected in vehicle config panel, do not create a marker on the map
      .map(deviceID => createDeviceMarker(deviceID)); // Init first seen device markers.
}

export function isVehSelected(deviceID) {
   const selectedDeviceIds = Object.values(storage.selectedDevices).map(devObj => { return devObj.id; });
   return deviceID && selectedDeviceIds.includes(deviceID) ? true : false;
}

//Process it into a format we can use, and initilize device markers.
export function processDeviceData(device) {
   const {
      dateTime,
      device: {
         id: deviceID
      },
      id,
      latitude: lat,
      longitude: lng,
      speed,
   } = device;

   // If vehicle is not selected in vehicle config panel, do not save device data to memory
   if (!isVehSelected(deviceID)) {
      return deviceID;
   }
   const dateTimeInt = moment(dateTime).unix();
   const latLng = [lat, lng];
   const data = { latLng, speed };
   const firstDeviceMarker = saveDeviceDataToMemory(deviceID, dateTimeInt, data);

   // Note the name of vehicle that is being processed
   if (typeof storage.selectedDevices[deviceID] !== "undefined" && storage.selectedDevices[deviceID].visible) {
      storage.historicalVehsFetched[deviceID] = storage.selectedDevices[deviceID].name;
      storage.realTimeDataForVehsFetched[deviceID] = storage.selectedDevices[deviceID].name;

      // Throw Event on discovering a Vehicle's LatLng
      if (deviceID && lat && lng) {
         splSrv.events.exec("onNewVehLatLng", deviceID, latLng);
      }
   }

   if (firstDeviceMarker) {
      return deviceID;
   }
}

export function saveDeviceDataToMemory(deviceID, dateTime, data) {
   const initDeviceMarker = createObjectKeyIfNotExist(logRecordsData, deviceID);
   const deviceObject = logRecordsData[deviceID];

   if (initDeviceMarker) {
      deviceObject.orderedDateTimes = [];
   }

   const initDeviceDateTime = createObjectKeyIfNotExist(deviceObject, dateTime);
   if (initDeviceDateTime) {
      insertIntoOrderedArray(deviceObject.orderedDateTimes, dateTime);
   };

   deviceObject[dateTime] = data;
   return initDeviceMarker;
}
