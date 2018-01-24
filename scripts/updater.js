const fs = require('fs');
const { EventEmitter } = require('events');
const path = require('path');
const httpUtils = require('../scripts/httputils');
const unzip = require('unzip');

class ClientUpdater extends EventEmitter {
    constructor(options) {
        super();
        if (!options) throw new Error('Invalid options provided to client updater');
        this.updateCheckUrl = options.updateCheckUrl;
        this.clientDownloadUrl = options.clientDownloadUrl;
        this.cacheDownloadUrl = options.cacheDownloadUrl;

        if (
            [options.updateCheckUrl, options.clientDownloadUrl, options.cacheDownloadUrl].filter(function(str) {
                return !str || !str.startsWith('http://');
            }).length > 0
        ) {
            throw new Error('Malformed options object, ');
        }

        this.game_assets_folder = path.join(__dirname, '../', 'game_assets');
        this.clientLocation = path.join(this.game_assets_folder, 'client.jar');
        this.cacheLocation = path.join(this.game_assets_folder, 'cache.zip');
        this.cacheFolderLocation = path.join(this.game_assets_folder, 'cache');
        this.versionsLocation = path.join(this.game_assets_folder, 'versions.json');
    }

    update() {
        const updater = this;

        updater.emit('status', 'Obtaining latest version data');
        return httpUtils
            .get(this.updateCheckUrl, 'application/json', true)
            .then(function(res) {
                let latestVersionData;
                let currentVersionData;
                //Get the latest version data file
                try {
                    updater.emit('status', 'Parsing latest version data...');
                    latestVersionData = JSON.parse(res.body);
                } catch (err) {
                    this.emit('status', 'Error parsing latest version data: ' + err);
                    return Promise.reject(err);
                }

                try {
                    updater.emit('status', 'Obtaining local version data...');
                    currentVersionData = require(updater.versionsLocation);
                } catch (err) {
                    updater.emit('status', 'Could not obtain latest version data: ' + err);
                    currentVersionData = null;
                }

                if (currentVersionData == null) {
                    updater.emit('status', 'Checking game assets folder exists');
                    try {
                        const stat = fs.statSync(updater.game_assets_folder);
                        updater.emit('status', 'Game assets exists');
                    } catch (err) {
                        try {
                            updater.emit('status', 'Creating game assets folder');
                            fs.mkdirSync(updater.game_assets_folder);
                        } catch (err) {
                            updater.emit('status', 'Error creating game assets folder ' + err);
                            return Promise.reject(err);
                        }
                    }
                }

                const hashType = latestVersionData.hashType;
                const hashEncoding = latestVersionData.hashEncoding;
                const clientCRC = latestVersionData.clientCRC;
                const cacheCRC = latestVersionData.cacheCRC;


                let clientExistsInPath;
                let cacheExistsInPath;

                try {
                    updater.emit('status', 'Checking client exists.');
                    fs.statSync(updater.clientLocation);
                    clientExistsInPath = true;
                } catch (err) {
                    clientExistsInPath = false;
                }

                try {
                    updater.emit('status', 'Checking cache exists.');
                    fs.statSync(updater.cacheLocation);
                    cacheExistsInPath = true;
                } catch (err) {
                    cacheExistsInPath = false;
                }

                function checksumFile(path, checksum, unlink) {
                    return new Promise(function(resolve, reject) {
                        fs.createReadStream(path)
                            .pipe(require('crypto').createHash(checksum.hashType).setEncoding(checksum.hashEncoding))
                            .once('finish', function() {
                                const fileHash = this.read();
                                if (fileHash != checksum.hashValue) {
                                    let unlinked = false;
                                    try {
                                        if (unlink) {
                                            fs.unlinkSync(path);
                                            unlink = true;
                                        }
                                    } catch (err) {
                                        unlink = false;
                                    }
                                    return reject(new Error('File hash did not match checksum expected : ' + checksum.hashValue + ' actual : ' + fileHash + ' unlinked: ' + unlink));
                                } else {
                                    return resolve({
                                        path,
                                        checksum,
                                    });
                                }
                            }).once('error', reject)
                    });
                }

                const clientChecksum = {
                    hashType,
                    hashEncoding,
                    hashValue: clientCRC,
                }

                const cacheChecksum = {
                    hashType,
                    hashEncoding,
                    hashValue: cacheCRC,
                }

                const asyncChecks = [];

                if (clientExistsInPath) {
                    updater.emit('status', 'Verying client..please wait.');
                    asyncChecks[asyncChecks.length] = checksumFile(updater.clientLocation, clientChecksum, true);
                }

                if (cacheExistsInPath) {
                    updater.emit('status', 'Verying cache..please wait.');
                    asyncChecks[asyncChecks.length] = checksumFile(updater.cacheLocation, cacheChecksum, true);
                }

                function run(crcMismatch) {
                    const promises = [];

                    if (crcMismatch || !clientExistsInPath ||
                        !currentVersionData ||
                        currentVersionData.client_version != latestVersionData.client_version
                    ) {
                        updater.emit('status', 'Could not find client...downloading...');
                        promises[promises.length] = httpUtils.downloadHttpFile(
                            updater.clientDownloadUrl,
                            updater.clientLocation,
                            'application/java-archive', clientChecksum
                        );
                    }

                    if (crcMismatch || !cacheExistsInPath ||
                        !currentVersionData ||
                        currentVersionData.cache_version != latestVersionData.cache_version
                    ) {
                        updater.emit('status', 'Could not find cache...downloading...');
                        promises[promises.length] = httpUtils.downloadHttpFile(
                            updater.cacheDownloadUrl,
                            updater.cacheLocation,
                            'application/zip', cacheChecksum
                        );
                    }

                    if (promises.length) {
                        if (!crcMismatch) {
                            updater.emit('status', 'Update found... updating files..please wait');
                        } else {
                            updater.emit('status', 'Attempting to correct error, hold tight...');
                        }

                        return Promise.all(promises).then(function(arr) {
                            console.log('downloaded files')
                            updater.emit('status', 'Succesfully updated files.. writing version file');

                            return new Promise(function(resolve, reject) {
                                const ws = fs.createWriteStream(updater.versionsLocation);
                                ws.once('finish', function() {
                                    updater.emit('status', 'Updated version file');
                                    return resolve({
                                        clientPath: updater.clientLocation,
                                        cachePath: updater.cacheLocation,
                                        cacheFolderPath: updater.cacheFolderLocation,
                                        status: 'Updated',
                                        newClientVersion: latestVersionData.client_version,
                                        oldClientVersion: (currentVersionData && currentVersionData.client_version) || null,
                                        newCacheVersion: latestVersionData.cache_version,
                                        oldCacheVersion: (currentVersionData && currentVersionData.cache_version) || null,
                                    });
                                });

                                ws.once('error', function(err) {
                                    return reject(err);
                                });

                                ws.write(JSON.stringify(latestVersionData));
                                ws.end();
                                ws.close();

                            });
                        });
                    } else {
                        return Promise.resolve({
                            clientPath: updater.clientLocation,
                            cachePath: updater.cacheLocation,
                            cacheFolderPath: updater.cacheFolderLocation,
                            status: 'UpToDate',
                            newClientVersion: latestVersionData.client_version,
                            oldClientVersion: currentVersionData.client_version,
                            newCacheVersion: latestVersionData.cache_version,
                            oldCacheVersion: currentVersionData.cache_version,
                        });
                    }
                }

                return Promise.all(asyncChecks).then(function(arr) {
                    console.log('found no mismatch')
                    const r1 = run(false);
                    console.log(r1)
                    return r1;
                }).catch(function(err) {
                    console.log(err);
                    console.log('found  mismatch')
                    updater.emit('error', err);
                    const r2 = run(true);
                    console.log(r2)
                    return r2;
                })
            })
            .then(function(result) {
                return new Promise(function(resolve, reject) {
                    let cacheExtracted;
                    try {
                        fs.statSync(result.cacheFolderPath)
                        cacheExtracted = true;
                    } catch (err) {
                        console.log(err)
                        cacheExtracted = false;
                    }

                    if (!cacheExtracted || result.status != 'UpToDate') {
                        updater.emit('status', 'extracting cache files... please wait')
                        fs.createReadStream(result.cachePath).pipe(unzip.Extract({ path: result.cacheFolderPath })).once('finish', function() {
                            return resolve(result);
                        }).once('error', function(err) {
                            console.log('error extracting zip');
                            return reject(err);
                        })
                    } else {
                        return resolve(result);
                    }
                })
            }).then(function(result) {
                updater.emit('updated', result);
                return Promise.resolve(result);
            })
            .catch(function(err) {
                updater.emit('error', err);
                return Promise.reject(err);
            });
    }
}
module.exports = ClientUpdater;