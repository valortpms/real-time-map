import L from "leaflet";
import storage from "../../../dataStore";

const LayerModel = {

   layerList: {
      movingLayer: L.layerGroup(),
      exceptionLayer: L.layerGroup()
   },

   initLayers() {
      this.layerList.movingLayer.addTo(storage.map);
      this.layerList.stoppedLayer = this.layerList.movingLayer;
      L.control.scale().addTo(storage.map);
   },

   createNewLayer(name) {
      this.layerList[name] = L.layerGroup();
      this.layerList[name].addTo(storage.map);
   },

   addToLayer(name, obj) {
      if (!this.layerList.hasOwnProperty(name)) {
         this.createNewLayer(name);
      }
      this.layerList[name].addLayer(obj);
   },

   removeFromLayer(name, obj) {
      this.layerList[name].removeLayer(obj);
   },

   isInLayer(name, obj) {
      return this.layerList.hasOwnProperty(name) ?
         this.layerList[name].hasLayer(obj) :
         false;
   },

   removeFromAllLayers(obj) {
      Object.values(this.layerList).forEach(layerGroup => {
         layerGroup.removeLayer(obj);
      });
   },

   addToMovingLayer(obj) {
      this.layerList.movingLayer.addLayer(obj);
   },

   showLayer(name) {
      this.layerList[name].addTo(storage.map);
   },

   clearLayersInGroup(name) {
      if (this.layerList.hasOwnProperty(name)) {
         this.layerList[name].clearLayers();
      }
   },

   clearAllLayers() {
      Object.values(this.layerList).forEach(layerGroup => {
         layerGroup.clearLayers();
      });
   }
};
export default LayerModel;
