const http = require('http')
const fs = require('fs')

exports.get = function(url, mimeType, parseBody) {
    return new Promise(function(res, rej) {
        const req = http.get(url, function(response) {
                if (response.statusCode != 200 || mimeType && !response.headers['content-type'] || !response.headers['content-type'].includes(mimeType)) {
                    console.log(response.headers['content-type'])
                    console.log(response.statusCode)
                    return rej(new Error('Invalid http response from ' + url))
                } else {
                    if (parseBody) {
                        let chunk = ''

                        response.on('data', function(c) {
                            chunk += c
                        })
                        response.once('error', function(err) {
                            return rej(err)
                        })
                        response.once('end', function() {
                            response.body = chunk
                            console.log(response.body)
                            return res(response)
                        })
                    } else {
                        return res(response)
                    }
                }
            })
            // Catches any errors with the request
        req.once('error', function(err) {
            return rej(err)
        })
    })
}

exports.downloadHttpFile = function(url, path, mimeType, checksum) {
    return exports.get(url, mimeType, false).then(function(res) {
        if (res.statusCode != 200) {
            return Promise.reject(new Error('Invalid response from server when trying to download file'))
        } else {
            return new Promise(function(resolve, reject) {
                console.log('creating file at ' + path)

                const writable = fs.createWriteStream(path)

                writable.on('finish', function() {
                    console.log('Firing writable finish for path ' + path)

                    let pathExists = false
                    try {
                        fs.statSync(path)
                        pathExists = true
                    } catch (err) {}

                    if (pathExists) {
                        if (checksum) {
                            console.log(checksum)
                            if (!checksum.hashType || !checksum.hashEncoding || !checksum.hashValue) return reject(new Error('Invalid checksum object'))

                            console.log('creating read stream for path ' + path)
                            fs.createReadStream(path)
                                .pipe(require('crypto').createHash(checksum.hashType).setEncoding(checksum.hashEncoding).once('error', function(err) {
                                    console.log('Error creating crc code')
                                    return reject(err)
                                }))
                                .once('finish', function() {
                                    console.log('Finished reading stream')
                                    const fileHash = this.read()
                                    if (fileHash != checksum.hashValue) {
                                        console.log('Checksums did not match')
                                        console.log(fileHash)
                                        console.log(checksum.hashValue)
                                        return reject(new Error('Downladed file checksum did not match given checksum'))
                                    } else {
                                        console.log('Checksums matched')
                                        return resolve(path)
                                    }
                                }).once('error', reject)
                        } else {
                            return resolve(path)
                        }
                    } else {
                        console.log('File did not exist.. attempting to redownload' + path)
                        return resolve(exports.downloadHttpFile(url, path, mimeType, checksum))
                    }
                }).on('error', function(err) {
                    console.log(err)
                    return reject(err)
                })

                res.pipe(writable).on('error', function(err) {
                    console.log('Error reading response')
                    return reject(err)
                })
            })
        }
    })
}

module.exports = exports