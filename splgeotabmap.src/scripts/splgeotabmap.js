geotab.addin.htmlexample = (elt, service) => {
   let sensorTblObj = elt.querySelector("#SplGeotabMapContainer .splTable");
   let vehNameObj = elt.querySelector("#SplGeotabMapContainer .title strong");
   let vehSpeedObj = elt.querySelector("#SplGeotabMapContainer .title div");

   service.actionList.attachMenu("vehicleMenu", (_, rest) => {
      return Promise.resolve([{
         title: "Show SpartanLync Sensors",
         clickEvent: "ShowSplDeviceInfo",
         data: rest.device
      }]);
   });

   service.actionList.attach("ShowSplDeviceInfo", ({ id }) => {
      Promise
         .all([
            service.api.call("Get", {
               typeName: "Device",
               search: { id }
            }),
            service.api.call("Get", {
               typeName: "DeviceStatusInfo",
               search: { deviceSearch: { id } }
            })
         ])
         .then(([
            [device],
            [dsi]
         ]) => {
            showVehDetailsPanel(id, device.name, dsi.speed);
         });
   });

   service.events.attach("over", data => {
      if (data.type === "device") {
         service.api.call("Get", {
            typeName: "Device",
            search: { id: data.entity.id }
         }).then(function(result) {
            if (result[0]) {
               var vehObj = result[0];
               showVehTooltip(data.entity.id, vehObj.name);
               showVehDetailsPanel(data.entity.id, vehObj.name, null);
            }
            //
            else {
               console.log("Device location can't be found!");
            }
         });
      }
   });

   let showVehTooltip = function(vehId, vehName) {
      service.tooltip.show({
         icon: "data:image/png;base64,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",
         main: "SpartanLync sensors detected",
         secondary: ["Temptrac", "TPMS"],
         additional: ["( Click 'Show SpartanLync Sensors' for more details )"],
      }, 0);
   };

   let showVehDetailsPanel = function(vehId, vehName, vehSpeed) {
      vehNameObj.innerHTML = vehName;
      vehSpeedObj.innerHTML = vehSpeed ? vehSpeed + " km/h" : "";

      if (sensorTblObj.classList.contains("hidden")) {
         sensorTblObj.classList.remove("hidden");
      }
   };
};