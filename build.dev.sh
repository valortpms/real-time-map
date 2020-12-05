#!/bin/bash

# Settings
BUILD_DEV_EXTENSION=".dev"
ADDIN_DEV_CONFIG_JSON_TITLE_SUFFIX=" (Dev)"
ADDIN_DEV_CONFIG_JSON_MENU_PATH="ActivityLink\/"
#
TEMPLATE_FILES="config.json favicon.ico favicon.png index.html"
BUILD_UNIX_TIMESTAMP_FILE="build.meta"
BUILD_PUBLIC_DIR="splmap"
BUILD_DEV_PUBLIC_DIR="${BUILD_PUBLIC_DIR}${BUILD_DEV_EXTENSION}"
BUILD_TEMPLATE_DIR="_splmap.Template"
BUILD_RELATIVE_PATH="../_Builds"
BUILD_DIST_RELATIVE_PATH="./dist"
BUILD_DEPLOY_RELATIVE_PATH="../../src/public"
MAPS_ARCHIVE_RELATIVE_PATH="../../src/map.src"
ZIP_CMD="/usr/bin/7z"
RSYNC_CMD="/usr/bin/rsync"
MINIFY_CMD="/c/Users/lmit/AppData/Roaming/npm/node_modules/terser/bin/terser"
#
SPLGEOTABMAP_PUBLIC_DIR="splgeotabmap"
SPLGEOTABMAP_DEV_URL="https://help.spartansense.com/geotab/splgeotabmap${BUILD_DEV_EXTENSION}/splgeotabmap.html"
SPLGEOTABMAP_DEV_PUBLIC_DIR="${SPLGEOTABMAP_PUBLIC_DIR}${BUILD_DEV_EXTENSION}"
SPLGEOTABMAP_SRC_ROOT_PATH="${SPLGEOTABMAP_PUBLIC_DIR}.src"
SPLGEOTABMAP_SRC_MIN_FILES="scripts/lang.en.js scripts/lang.es.js scripts/lang.fr.js scripts/splgeotabmap.js scripts/tools.js scripts/ui.js"
SPLGEOTABMAP_SRC_BUILD_PATHS="config.json images/ scripts/ ${SPLGEOTABMAP_PUBLIC_DIR}.html styles/"
SPLGEOTABMAP_SRC_INDEX_FILE="${SPLGEOTABMAP_PUBLIC_DIR}.html"
SPLGEOTABMAP_DIST_RELATIVE_PATH="../../src/public/${SPLGEOTABMAP_PUBLIC_DIR}"
SPLGEOTABMAP_DIST_DEV_RELATIVE_PATH="../../src/public/${SPLGEOTABMAP_DEV_PUBLIC_DIR}"

# Init
UNIX_TIMESTAMP=`date +%s`
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BUILD_ROOT_PATH="${CURRENT_DIR}/$BUILD_RELATIVE_PATH"
BUILD_TEMPLATE_PATH="$BUILD_ROOT_PATH/$BUILD_TEMPLATE_DIR"
BUILD_PUBLIC_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/${BUILD_PUBLIC_DIR}"
BUILD_DEV_PUBLIC_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/$BUILD_DEV_PUBLIC_DIR"
LARAVEL_APP_CONFIG_PATH="${CURRENT_DIR}/../../src/config/app.php"
VERSION=`grep "version" $LARAVEL_APP_CONFIG_PATH | tr -d '[:space:]' | cut -f4 -d"'"`
BUILD_ZIP_FILE="${BUILD_PUBLIC_DIR}.zip"
BUILD_ZIP_FILE_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/${BUILD_ZIP_FILE}"
BUILD_DEV_ZIP_FILE="${BUILD_PUBLIC_DIR}${BUILD_DEV_EXTENSION}.v${VERSION}.zip"
BUILD_DEV_ZIP_FILE_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/${BUILD_DEV_ZIP_FILE}"
BUILD_UNIX_TIMESTAMP_PATH="${BUILD_PUBLIC_PATH}/${BUILD_UNIX_TIMESTAMP_FILE}"
ADDIN_CONFIG_JSON_FILE_PATH="${BUILD_PUBLIC_PATH}/config.json"
ADDIN_DEV_CONFIG_JSON_FILE_PATH="${BUILD_DEV_PUBLIC_PATH}/config.json"
ADDIN_DEV_BUILD_FILE_PATH="${BUILD_DEV_PUBLIC_PATH}/bundle.js"
MAPS_ARCHIVE_PATH="${CURRENT_DIR}/${MAPS_ARCHIVE_RELATIVE_PATH}"
#
SPLGEOTABMAP_UNIX_TIMESTAMP_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/${SPLGEOTABMAP_PUBLIC_DIR}/${BUILD_UNIX_TIMESTAMP_FILE}"
SPLGEOTABMAP_UNIX_TIMESTAMP_DEV_PATH="${BUILD_DEPLOY_RELATIVE_PATH}/${SPLGEOTABMAP_DEV_PUBLIC_DIR}/${BUILD_UNIX_TIMESTAMP_FILE}"
SPLGEOTABMAP_SRC_ROOT_PATH="${CURRENT_DIR}/${SPLGEOTABMAP_SRC_ROOT_PATH}"
SPLGEOTABMAP_DIST_ROOT_PATH="${CURRENT_DIR}/${SPLGEOTABMAP_DIST_RELATIVE_PATH}"
SPLGEOTABMAP_DIST_DEV_ROOT_PATH="${CURRENT_DIR}/${SPLGEOTABMAP_DIST_DEV_RELATIVE_PATH}"
SPLGEOTABMAP_DIST_INDEX_PATH="${SPLGEOTABMAP_DIST_ROOT_PATH}/${SPLGEOTABMAP_SRC_INDEX_FILE}"
SPLGEOTABMAP_CHANGED_FILES="$( cd ${CURRENT_DIR}; git status . | grep ${SPLGEOTABMAP_PUBLIC_DIR} 2>&1 )"

# Generate new build
echo "---- BUILDING SpartanLync v${VERSION} SplMap App ----"
npm run build
EXIT_CODE=$?
if [[ $EXIT_CODE != 0 ]]; then exit $EXIT_CODE; fi

# Copy files
echo -ne "\n---- Assembling SpartanLync v${VERSION} BUILD FILES into [ ${BUILD_PUBLIC_PATH} ] ----\n"
rm -rf ${BUILD_PUBLIC_PATH}
mkdir ${BUILD_PUBLIC_PATH}
cp -ar ${CURRENT_DIR}/${BUILD_DIST_RELATIVE_PATH}/* ${BUILD_PUBLIC_PATH}
for file in $TEMPLATE_FILES; do cp -a $BUILD_TEMPLATE_PATH/$file ${BUILD_PUBLIC_PATH}; done

# Modify version number in Add-In Source config.json
cp -a $ADDIN_CONFIG_JSON_FILE_PATH "${ADDIN_CONFIG_JSON_FILE_PATH}.bak"
OLDVERSION=`grep "version" $ADDIN_CONFIG_JSON_FILE_PATH | tr -d '[:space:]",' | cut -f2 -d":"`
if [ "${OLDVERSION}" != "${VERSION}" ]; then
  echo -ne "\n---- Modifying Version from [ ${OLDVERSION} ] to [ ${VERSION} ] in [ ${ADDIN_CONFIG_JSON_FILE_PATH} ] ---\n"
  ERROR=$( { sed -i "s/${OLDVERSION}/${VERSION}/g" "${ADDIN_CONFIG_JSON_FILE_PATH}"; } 2>&1 )
  EXIT_CODE=$?
  if [[ $EXIT_CODE != 0 ]]; then echo -ne "\n**** SED VERSION MODIFY ERROR!! ****...Try Again!\n${ERROR}\n\n"; exit $EXIT_CODE; fi
fi
rm -rf "${ADDIN_CONFIG_JSON_FILE_PATH}.bak"

# Perform SplGeotabMap Operations only if files have changed
if [ ! -z "${SPLGEOTABMAP_CHANGED_FILES}" ]
then
   # SplGeotabMap - Generate new DEV/LIVE DIST
   echo -ne "\n---- SplGeotabMap -   Copying from  [ ${SPLGEOTABMAP_SRC_ROOT_PATH} ]\n\t\t\t\tto  [ ${SPLGEOTABMAP_DIST_ROOT_PATH} ]\n\t\t\t\tand [ ${SPLGEOTABMAP_DIST_DEV_ROOT_PATH} ]\n"
   rm -rf ${SPLGEOTABMAP_DIST_ROOT_PATH}
   rm -rf ${SPLGEOTABMAP_DIST_DEV_ROOT_PATH}
   mkdir ${SPLGEOTABMAP_DIST_ROOT_PATH}
   mkdir ${SPLGEOTABMAP_DIST_DEV_ROOT_PATH}
   for path in $SPLGEOTABMAP_SRC_BUILD_PATHS; do cp -a $SPLGEOTABMAP_SRC_ROOT_PATH/$path ${SPLGEOTABMAP_DIST_ROOT_PATH}; done
   for path in $SPLGEOTABMAP_SRC_BUILD_PATHS; do cp -a $SPLGEOTABMAP_SRC_ROOT_PATH/$path ${SPLGEOTABMAP_DIST_DEV_ROOT_PATH}; done

   # SplGeotabMap - Minify JS files in LIVE DIST + Update LIVE DIST INDEX file with minified file names
   echo -ne "\n---- SplGeotabMap - Minify files in [ ${SPLGEOTABMAP_DIST_ROOT_PATH} ]\n\tand\n     Updating INDEX file [ ${SPLGEOTABMAP_DIST_INDEX_PATH} ]\n"
   cd ${SPLGEOTABMAP_DIST_ROOT_PATH}
   for SCRIPT_FILE in $SPLGEOTABMAP_SRC_MIN_FILES;
   do
      SCRIPT_PATH="${SPLGEOTABMAP_DIST_ROOT_PATH}/${SCRIPT_FILE}"
      SCRIPT_MIN_PATH="${SCRIPT_PATH/\.js/\.min.js}"
      SCRIPT_FILE_ESCAPED=${SCRIPT_FILE/\//\\/}
      SCRIPT_MIN_FILE=${SCRIPT_FILE/\.js/\.min.js}
      SCRIPT_MIN_FILE_ESCAPED=${SCRIPT_MIN_FILE/\//\\/}

      if [ ! -f ${SCRIPT_FILE} ]; then echo -ne "\n**** ERROR!! DIST FILE NOT FOUND!! **** [ ${SCRIPT_PATH} ]\n\n"; exit 1; fi
      printf "\t- %-25s=>\t%-25s\n" ${SCRIPT_FILE} ${SCRIPT_FILE/\.js/\.min.js}

      # Minify JS
      ERROR=$( { ${MINIFY_CMD} --compress --mangle --output ${SCRIPT_MIN_PATH} -- ${SCRIPT_FILE}; } 2>&1 )
      EXIT_CODE=$?
      if [[ $EXIT_CODE != 0 ]]; then echo -ne "\n**** CURL ERROR!! ****...Try Again!\n${ERROR}\n\n"; exit $EXIT_CODE; fi
      rm -f $SCRIPT_FILE

      # Update INDEX
      sed -i "s/${SCRIPT_FILE_ESCAPED}/${SCRIPT_MIN_FILE_ESCAPED}/g" ${SPLGEOTABMAP_DIST_INDEX_PATH}
   done
   cd ${CURRENT_DIR}
fi

# Create SplMap Build Metadata File
echo -ne "\n---- Creating SplMap Build Metadata File [ ${BUILD_UNIX_TIMESTAMP_PATH} ] ---\n"
echo "SpartanLync v${VERSION}" > ${BUILD_UNIX_TIMESTAMP_PATH}
echo "${UNIX_TIMESTAMP}" >> ${BUILD_UNIX_TIMESTAMP_PATH}

# Create SplGeotabMap Build Metadata Files
if [ ! -z "${SPLGEOTABMAP_CHANGED_FILES}" ]
then
   echo -ne "\n---- Copying Build Metadata File to SplGeotabMap deployment folder(s)\n\t     [ ${SPLGEOTABMAP_UNIX_TIMESTAMP_PATH} ]\n\t and [ ${SPLGEOTABMAP_UNIX_TIMESTAMP_DEV_PATH} ]\n"
   cp -a "${BUILD_UNIX_TIMESTAMP_PATH}" "${SPLGEOTABMAP_UNIX_TIMESTAMP_PATH}"
   cp -a "${BUILD_UNIX_TIMESTAMP_PATH}" "${SPLGEOTABMAP_UNIX_TIMESTAMP_DEV_PATH}"
fi

# Sync LIVE deployment folder with DEV folder
echo -ne "\n---- Copying LIVE folder [ ${BUILD_PUBLIC_PATH} ] to DEV folder [ ${BUILD_DEV_PUBLIC_PATH} ] ---\n"
rm -rf ${BUILD_DEV_PUBLIC_PATH}
cp -r -a "${BUILD_PUBLIC_PATH}" "${BUILD_DEV_PUBLIC_PATH}"

# Update config.json with correct URLs, MyGeotab Menu Paths / Titles for DEV build
echo -ne "\n---- Fixing URLs, MyGeotab Menu Paths / Titles in DEV folder [ ${ADDIN_DEV_CONFIG_JSON_FILE_PATH} ]\n"
sed -i "s/\/${BUILD_PUBLIC_DIR}\//\/${BUILD_PUBLIC_DIR}${BUILD_DEV_EXTENSION}\//g" ${ADDIN_DEV_CONFIG_JSON_FILE_PATH}
sed -i "s/Map\"/Map${ADDIN_DEV_CONFIG_JSON_TITLE_SUFFIX}\"/g" ${ADDIN_DEV_CONFIG_JSON_FILE_PATH}
sed -i "s/\"path\": \"\"/\"path\": \"${ADDIN_DEV_CONFIG_JSON_MENU_PATH}\"/g" ${ADDIN_DEV_CONFIG_JSON_FILE_PATH}

# Update SplMap DEV build (bundle.js) with SplGeotabMap DEV URL (https://help.spartansense.com/geotab/splgeotabmap.dev/splgeotabmap.html)
echo -ne "\n---- Updating SplMap DEV build [ ${ADDIN_DEV_BUILD_FILE_PATH} ] with SplGeotabMap DEV URL [ ${SPLGEOTABMAP_DEV_URL} ]\n"
sed -i "s/\/${SPLGEOTABMAP_PUBLIC_DIR}\//\/${SPLGEOTABMAP_PUBLIC_DIR}${BUILD_DEV_EXTENSION}\//g" ${ADDIN_DEV_BUILD_FILE_PATH}

# Create LIVE build ZIP file
echo -ne "\n---- Zipping Folder(s) [ ${BUILD_PUBLIC_PATH} ] and [ ${SPLGEOTABMAP_PUBLIC_DIR} ]\n\t       TO file [ ${BUILD_ZIP_FILE_PATH} ]\n"
rm -rf ${BUILD_ZIP_FILE_PATH}
(cd ${BUILD_DEPLOY_RELATIVE_PATH} && ${ZIP_CMD} a -r ${BUILD_ZIP_FILE} ${BUILD_PUBLIC_DIR} ${SPLGEOTABMAP_PUBLIC_DIR} > /dev/null)

# Create DEV build ZIP file
echo -ne "\n---- Zipping Folder(s) [ ${BUILD_DEV_PUBLIC_PATH} ] and [ ${SPLGEOTABMAP_DEV_PUBLIC_DIR} ]\n\t       TO file [ ${BUILD_DEV_ZIP_FILE_PATH} ]\n"
rm -rf ${BUILD_DEV_ZIP_FILE_PATH}
(cd ${BUILD_DEPLOY_RELATIVE_PATH} && ${ZIP_CMD} a -r ${BUILD_DEV_ZIP_FILE} ${BUILD_DEV_PUBLIC_DIR} ${SPLGEOTABMAP_DEV_PUBLIC_DIR} > /dev/null)

# Sync "Geotab\Real-Time-Maps\valor_src" working dev source code (hosted on Github https://github.com/valortpms/real-time-map repo)
# with
# "Geotab\src\map.src" (SpartanLync Map source code archive folder for hosting on Bitbucket, with GIT and NPM folders excluded)
#
echo -ne "\n---- Syncing Working Source code folder \"${CURRENT_DIR}\"\n\t\t    with Archive folder \"${MAPS_ARCHIVE_PATH}\"\n"
rm -rf ${MAPS_ARCHIVE_PATH}
ERROR=$( { ${RSYNC_CMD} -rv --exclude=node_modules --exclude=.git "${CURRENT_DIR}/" "${MAPS_ARCHIVE_PATH}"; } 2>&1 )
EXIT_CODE=$?
if [[ $EXIT_CODE != 0 ]]; then echo -ne "\n**** RSYNC ERROR!! ****...Try Again!\n${ERROR}\n\n"; exit $EXIT_CODE; fi

echo -ne "Done\n"
