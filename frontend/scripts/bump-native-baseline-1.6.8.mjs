import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const VERSION = '1.6.8';
const CODE = 10608;

const appPath = path.join(root, 'app.json');
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
if (app.expo.version !== '1.6.7' || app.expo.runtimeVersion !== '1.6.7' || app.expo.android?.versionCode !== 10607) {
  throw new Error('Unexpected native baseline identity before 1.6.8 migration');
}
app.expo.version = VERSION;
app.expo.runtimeVersion = VERSION;
app.expo.android.versionCode = CODE;
app.expo.extra.otaRuntimeVersion = VERSION;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

const gradlePath = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const gradleBefore = 'def onCampusVersionName = System.getenv("APP_VERSION_NAME") ?: "1.6.7"\ndef onCampusVersionCode = (System.getenv("APP_VERSION_CODE") ?: "10607").toInteger()';
const gradleAfter = 'def onCampusVersionName = System.getenv("APP_VERSION_NAME") ?: "1.6.8"\ndef onCampusVersionCode = (System.getenv("APP_VERSION_CODE") ?: "10608").toInteger()';
if ((gradle.split(gradleBefore).length - 1) !== 1) throw new Error('Gradle baseline identity did not match 1.6.7');
gradle = gradle.replace(gradleBefore, gradleAfter);
fs.writeFileSync(gradlePath, gradle);

const stringsPath = path.join(root, 'android/app/src/main/res/values/strings.xml');
let strings = fs.readFileSync(stringsPath, 'utf8');
const runtimeBefore = '<string name="expo_runtime_version" translatable="false">1.6.7</string>';
const runtimeAfter = '<string name="expo_runtime_version" translatable="false">1.6.8</string>';
if ((strings.split(runtimeBefore).length - 1) !== 1) throw new Error('Android runtime string did not match 1.6.7');
strings = strings.replace(runtimeBefore, runtimeAfter);
fs.writeFileSync(stringsPath, strings);

console.log('OnCampus native baseline migrated to 1.6.8 / runtime 1.6.8 / versionCode 10608.');
