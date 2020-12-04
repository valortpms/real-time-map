import storage from "../../../dataStore";
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

   if (!isVehSelected(deviceID)) {
      return deviceID;
   }
   const roundedDateTime = new Date(dateTime);
   roundedDateTime.setMilliseconds(0);
   const dateTimeInt = roundedDateTime.getTime();

   const latLng = [lat, lng];
   const data = { latLng, speed };
   const firstDeviceMarker = saveDeviceDataToMemory(deviceID, dateTimeInt, data);

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
