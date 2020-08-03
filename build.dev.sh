#!/bin/bash

# Settings
BUILD_EXTENSION=".dev"
ADDIN_CONFIG_JSON_TITLE_SUFFIX=" (Dev)"
ADDIN_CONFIG_JSON_MENU_PATH="ActivityLink\/"
#
TEMPLATE_FILES="config.json favicon.ico favicon.png index.html"
BUILD_UNIX_TIMESTAMP_FILE="build.meta"
BUILD_PUBLIC_DIR="splmap${BUILD_EXTENSION}"
BUILD_TEMPLATE_DIR="_splmap.Template"
BUILD_RELATIVE_PATH="../_Builds"
BUILD_PROD_RELATIVE_PATH="./dist"
MAPS_ARCHIVE_RELATIVE_PATH="../../src/map.src"
ZIP_CMD="/usr/bin/7z"
RSYNC_CMD="/usr/bin/rsync"

# Init
UNIX_TIMESTAMP=`date +%s`
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BUILD_ROOT_PATH="${CURRENT_DIR}/$BUILD_RELATIVE_PATH"
BUILD_TEMPLATE_PATH="$BUILD_ROOT_PATH/$BUILD_TEMPLATE_DIR"
BUILD_PUBLIC_PATH="$BUILD_ROOT_PATH/$BUILD_PUBLIC_DIR"
LARAVEL_APP_CONFIG_PATH="${CURRENT_DIR}/../../src/config/app.php"
VERSION=`grep "version" $LARAVEL_APP_CONFIG_PATH | tr -d '[:space:]' | cut -f4 -d"'"`
BUILD_PUBLIC_ZIP_FILE="${BUILD_PUBLIC_DIR}.v${VERSION}.zip"
BUILD_PUBLIC_ZIP_FILE_PATH="$BUILD_ROOT_PATH/${BUILD_PUBLIC_ZIP_FILE}"
BUILD_UNIX_TIMESTAMP_PATH="${BUILD_PUBLIC_PATH}/${BUILD_UNIX_TIMESTAMP_FILE}"
ADDIN_CONFIG_JSON_FILE_PATH="${BUILD_PUBLIC_PATH}/config.json"
MAPS_ARCHIVE_PATH="${CURRENT_DIR}/${MAPS_ARCHIVE_RELATIVE_PATH}"

# Generate new build
echo "---- BUILDING SpartanLync v${VERSION} SplMap App ----"
npm run build
EXIT_CODE=$?
if [[ $EXIT_CODE != 0 ]]; then exit $EXIT_CODE; fi

# Copy files
echo "---- MOVING SpartanLync v${VERSION} BUILD FILES ----"
rm -rf ${BUILD_PUBLIC_PATH}
mkdir ${BUILD_PUBLIC_PATH}
cp -ar ${CURRENT_DIR}/${BUILD_PROD_RELATIVE_PATH}/* ${BUILD_PUBLIC_PATH}
for file in $TEMPLATE_FILES; do cp -a $BUILD_TEMPLATE_PATH/$file ${BUILD_PUBLIC_PATH}; done

# Modify version number in Add-In Source config.json
cp -a $ADDIN_CONFIG_JSON_FILE_PATH "${ADDIN_CONFIG_JSON_FILE_PATH}.bak"
OLDVERSION=`grep "version" $ADDIN_CONFIG_JSON_FILE_PATH | tr -d '[:space:]",' | cut -f2 -d":"`
if [ "${OLDVERSION}" != "${VERSION}" ]; then
  echo -ne "---- MODIFYING Version from [ ${OLDVERSION} ] to [ ${VERSION} ] in ${ADDIN_CONFIG_JSON_FILE_PATH}\n"
  ERROR=$( { sed -i "s/${OLDVERSION}/${VERSION}/g" "${ADDIN_CONFIG_JSON_FILE_PATH}"; } 2>&1 )
  EXIT_CODE=$?
  if [[ $EXIT_CODE != 0 ]]; then echo -ne "\n**** SED VERSION MODIFY ERROR!! ****...Try Again!\n${ERROR}\n\n"; exit $EXIT_CODE; fi
fi
rm -rf "${ADDIN_CONFIG_JSON_FILE_PATH}.bak"

# Update config.json with correct URL/Menu paths & Titles for build
echo -ne "---- FIXING URL/Menu paths & Titles in [ ${ADDIN_CONFIG_JSON_FILE_PATH} ]\n"
sed -i "s/\/splmap\//\/splmap${BUILD_EXTENSION}\//g" ${ADDIN_CONFIG_JSON_FILE_PATH}
sed -i "s/Map\"/Map${ADDIN_CONFIG_JSON_TITLE_SUFFIX}\"/g" ${ADDIN_CONFIG_JSON_FILE_PATH}
sed -i "s/\"path\": \"\"/\"path\": \"${ADDIN_CONFIG_JSON_MENU_PATH}\"/g" ${ADDIN_CONFIG_JSON_FILE_PATH}

# Create SplMap Build Metadata File
echo "---- Creating SplMap Build Metadata File: ${BUILD_UNIX_TIMESTAMP_PATH}"
echo "SpartanLync v${VERSION}" > ${BUILD_UNIX_TIMESTAMP_PATH}
echo "${UNIX_TIMESTAMP}" >> ${BUILD_UNIX_TIMESTAMP_PATH}

# Create ZIP file
echo "---- ZIPPING SplMap BUILD TO ${BUILD_PUBLIC_ZIP_FILE} ----"
rm -rf ${BUILD_PUBLIC_ZIP_FILE_PATH}
(cd ${BUILD_ROOT_PATH} && ${ZIP_CMD} a -r ${BUILD_PUBLIC_ZIP_FILE} ${BUILD_PUBLIC_DIR} > /dev/null)

#
# Sync "Geotab\Real-Time-Maps\valor_src" working dev source code (hosted on Github https://github.com/valortpms/real-time-map repo)
# with
# "Geotab\src\map.src" (SpartanLync Map source code archive folder for hosting on Bitbucket, with GIT and NPM folders excluded)
#
echo -ne "---- SYNCING \"${CURRENT_DIR}\"\n        with \"${MAPS_ARCHIVE_PATH}\"\n"
rm -rf ${MAPS_ARCHIVE_PATH}
ERROR=$( { ${RSYNC_CMD} -rv --exclude=node_modules --exclude=.git "${CURRENT_DIR}/" "${MAPS_ARCHIVE_PATH}"; } 2>&1 )
EXIT_CODE=$?
if [[ $EXIT_CODE != 0 ]]; then echo -ne "\n**** RSYNC ERROR!! ****...Try Again!\n${ERROR}\n\n"; exit $EXIT_CODE; fi

echo -ne "Done\n"
