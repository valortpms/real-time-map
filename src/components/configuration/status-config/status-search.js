import storage from "../../../dataStore";
import splSrv from "../../../spartanlync/services";
import { fromEvent } from "rxjs";
import { map, debounceTime } from "rxjs/operators";
import { getDiagnosticByName, getBlobStorage, saveBlobStorage, setBlobStorage } from "../../../services/api/helpers";
import { filterByVisibility } from "../utils/config-helpers";

export const diagnosticSearch = {
   resultsCache: {},
   displayList: {},

   get searchInput() {
      return document.getElementById("RTM-status-search-bar");
   },

   init(mapPropsToComponent) {
      // Init rxjs debounce search.
      const searchInputObservable$ = fromEvent(diagnosticSearch.searchInput, "input").pipe(map(i => i.currentTarget.value));
      const debouncedInput = searchInputObservable$.pipe(debounceTime(250));
      debouncedInput.subscribe((searchInput) => diagnosticSearch.buildSearchList(searchInput, mapPropsToComponent));
   },

   loadSavedStatusConfig(mapPropsToComponent) {

      return getBlobStorage().then(val => {
         if (val.length === 0) { return; }
         const cachedDiagnostics = JSON.parse(val[0].data);

         if (cachedDiagnostics.configData.Status) {
            diagnosticSearch.displayList = cachedDiagnostics.configData.Status;
            storage.selectedStatuses = filterByVisibility(diagnosticSearch.displayList);
            diagnosticSearch.buildStatusDisplayList(mapPropsToComponent);
         }
      });
   },

   buildSearchList(searchInput, mapPropstoComponent) {

      return getDiagnosticByName(searchInput).then(diagnosticResults => {

         diagnosticResults.forEach(diagnostic => {
            const {
               id,
               name,
               unitOfMeasure
            } = diagnostic;

            const visible = true;

            diagnosticSearch.resultsCache[name] = { name, id, visible, unitOfMeasure };
         });
         mapPropstoComponent(Object.values(diagnosticSearch.resultsCache));
      });
   },

   handleItemSelected(event, mapPropsToComponent) {
      event.preventDefault();
      diagnosticSearch.saveSelectedValue(mapPropsToComponent);
   },

   saveSelectedValue(mapPropsToComponent) {

      const { value } = diagnosticSearch.searchInput;
      const diagnosticData = diagnosticSearch.resultsCache[value];

      if (diagnosticData) {
         diagnosticSearch.displayList[diagnosticData.id] = diagnosticData;
         diagnosticSearch.searchInput.value = "";
         diagnosticSearch.saveConfig(mapPropsToComponent);
      }

      return diagnosticData;
   },

   buildStatusDisplayList(mapPropsToComponent) {
      mapPropsToComponent(Object.values(diagnosticSearch.displayList)
         .filter(diagnostic => diagnostic.id && diagnostic.name));
   },

   deleteItemFromStatusList(id, mapPropsToComponent) {
      delete diagnosticSearch.displayList[id];
      diagnosticSearch.saveConfig(mapPropsToComponent);
   },

   saveConfig(mapPropsToComponent) {
      storage.selectedStatuses = filterByVisibility(diagnosticSearch.displayList);
      storage.setBlobStorageObj ? setBlobStorage("Status", diagnosticSearch.displayList) : saveBlobStorage("Status", diagnosticSearch.displayList);
      storage.dateKeeper$.update();
      diagnosticSearch.buildStatusDisplayList(mapPropsToComponent);

      // Throw Event for post-Save operations
      splSrv.events.exec("onDiagnosticSearchSave");
   },

   toggleStatusVisibility(id, mapPropsToComponent) {
      const selectedDiagnostic = diagnosticSearch.displayList[id];
      selectedDiagnostic.visible = !selectedDiagnostic.visible;
      diagnosticSearch.saveConfig(mapPropsToComponent);
   },

   deleteAllItems(mapPropsToComponent) {
      diagnosticSearch.displayList = {};
      diagnosticSearch.saveConfig(mapPropsToComponent);
   },

   showAllItems(mapPropsToComponent) {
      Object.values(diagnosticSearch.displayList)
         .forEach(selectedDiagnostic =>
            selectedDiagnostic.visible = true
         );
      diagnosticSearch.saveConfig(mapPropsToComponent);
   },

   hideAllItems(mapPropsToComponent) {
      Object.values(diagnosticSearch.displayList)
         .forEach(selectedDiagnostic =>
            selectedDiagnostic.visible = false
         );
      diagnosticSearch.saveConfig(mapPropsToComponent);
   }
};
