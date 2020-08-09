geotab.addin.htmlexample = (elt, service) => {
  const my = {
    // Geotab API
    service: service,

    // UI Elements
    elt: elt,
    sensorTblObj: elt.querySelector("#SplGeotabMapContainer .splTable"),
    vehNameObj: elt.querySelector("#SplGeotabMapContainer .title strong"),
    vehSpeedObj: elt.querySelector("#SplGeotabMapContainer .title div"),
  };

  service.actionList.attachMenu("vehicleMenu", (_, rest) => {
    return Promise.resolve([
      {
        title: "Show SpartanLync Sensors",
        clickEvent: "ShowSplDeviceInfo",
        data: rest.device,
      },
    ]);
  });

  service.actionList.attach("ShowSplDeviceInfo", ({ id }) => {
    Promise.all([
      service.api.call("Get", {
        typeName: "Device",
        search: { id },
      }),
      service.api.call("Get", {
        typeName: "DeviceStatusInfo",
        search: { deviceSearch: { id } },
      }),
    ]).then(([[device], [dsi]]) => {
      showVehDetailsPanel(my, id, device.name, dsi.speed);
    });
  });

  service.events.attach("over", (data) => {
    if (data.type === "device") {
      service.api
        .call("Get", {
          typeName: "Device",
          search: { id: data.entity.id },
        })
        .then(function (result) {
          if (result[0]) {
            const vehObj = result[0];
            showVehTooltip(my, data.entity.id, vehObj.name);
            showVehDetailsPanel(my, data.entity.id, vehObj.name, null);
          }
          //
          else {
            console.log("Device location can't be found!");
          }
        });
    }
  });
};
