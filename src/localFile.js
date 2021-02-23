const { promisify } = require('es6-promisify')

const fs = typeof __webpack_require__ != 'function' ? require('fs') : null // eslint-disable-line camelcase
let fsOpen = fs && promisify(fs.open)
let fsRead = fs && promisify(fs.read)
let fsFStat = fs && promisify(fs.fstat)
let fsReadFile = fs && promisify(fs.readFile)

class LocalFile {
  constructor(source) {
    this.position = 0
    this.filename = source
    this.fd = fsOpen(this.filename, 'r')
  }

  async read(buffer, offset = 0, length, position) {
    let readPosition = position
    if (readPosition === null) {
      readPosition = this.position
      this.position += length
    }
    const ret = await fsRead(await this.fd, buffer, offset, length, position)
    if (typeof ret === 'object') return ret.bytesRead
    return ret
  }

  async readFile() {
    return fsReadFile(this.filename)
  }

  async stat() {
    if (!this._stat) {
      this._stat = await fsFStat(await this.fd)
    }
    return this._stat
  }
}

module.exports = LocalFile
