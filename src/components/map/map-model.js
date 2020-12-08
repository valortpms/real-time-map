import L from "leaflet";
import splSrv from "../../spartanlync/services";
import storage from "../../dataStore";
import { userAPI } from "../../services/api/user-api";
import { userInfo } from "../../dataStore/api-config";
import { resetTransitionAnimation } from "../../utils/helper";
import { showSnackBar } from "../snackbar/snackbar";
import { pausePlayModel } from "../controls/play-pause/play-pause-model";

let MAPBOX;
ACCESS_TOKEN: false;

export const mapModel = {

   handleMapCreated(element) {
      storage.map = new L.Map(element, {
         doubleClickZoom: false,
         closePopupOnClick: false,
         markerZoomAnimation: false,
         worldCopyJump: true
      });
      if (MAPBOX && MAPBOX.ACCESS_TOKEN) {
         mapModel.addMapBoxTileLayer(storage.map);
      }
      else {
         mapModel.addOSMTileLayer(storage.map);
      }

      // Execute any SpartanLync Listeners waiting for this moment when the map has changed due to animations
      storage.map.on("zoomend", () => {
         splSrv.events.exec("onFlyingComplete");
      });
      storage.map.on("zoom", resetTransitionAnimation);

      // On SPACE keyboard key, Toggle Pause/Play control panel operation
      storage.map.on("load", () => {
         document.addEventListener("keyup", pausePlayModel.togglePausePlayKeyboardHandler.bind(pausePlayModel));
      });

      // set to default location if user does not allow locating.
      const defautLocation = [43.515391, -79.684085];
      storage.map.setView(defautLocation, 12);
   },

   addMapBoxTileLayer: map => {
      L.tileLayer(`https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=${MAPBOX.ACCESS_TOKEN}`, {
         attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https: //www.mapbox.com/\">Mapbox</a>",
         minZoom: storage.minZoom,
         maxZoom: storage.maxZoom,
         id: "mapbox.streets",
         accessToken: MAPBOX.ACCESS_TOKEN
      }).addTo(map);
   },

   addOSMTileLayer(map) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
         subdomains: ["a", "b", "c"],
         minZoom: storage.minZoom,
         maxZoom: storage.maxZoom,
      }).addTo(map);
   },

   locateUserAndSetView() {
      storage.map.locate({ setView: true, maxZoom: 12 });
   },

   setMapToCompanyAddress() {
      return userAPI.getUserInfo(userInfo.userName)
         .then(result => {
            userAPI.getCoordinatesFromAddress(result[0].companyAddress)
               .then(result =>
                  mapModel.mapSetView(L.latLng(result[0].y, result[0].x))
               )
               .catch(() => mapModel.mapSetView([]));
         })
         .catch(() => showSnackBar(splmap.tr("error_server_unavailable")));
   },

   mapSetView(latlng) {
      if (latlng.length === 0) {
         storage.map.setView([43.515228, -79.683523], 12);
         console.warn("Default location set to user location.");
      }
      else {
         storage.map.setView(latlng, 12);
         console.warn(`Location set to: ${latlng}`);
      }
   }

};
