/*!
 * remoteFile.js from cram-js (https://github.com/GMOD/cram-js)
 *
 * MIT License
 *
 * Copyright (c) 2017 Robert Buels
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fetch = require('cross-fetch')
const BufferCache = require('./bufferCache')

class RemoteFile {
  constructor(source) {
    this.position = 0
    this.url = source
    this.cache = new BufferCache({
      fetch: (start, length) => this._fetch(start, length),
    })
  }

  async _fetch(position, length) {
    const headers = {}
    if (length < Infinity) {
      headers.range = `bytes=${position}-${position + length}`
    } else if (length === Infinity && position !== 0) {
      headers.range = `bytes=${position}-`
    }
    const response = await fetch(this.url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      mode: 'cors',
    })
    if (
      (response.status === 200 && position === 0) ||
      response.status === 206
    ) {
      const nodeBuffer = Buffer.from(await response.arrayBuffer())

      // try to parse out the size of the remote file
      const sizeMatch = /\/(\d+)$/.exec(response.headers.get('content-range'))
      if (sizeMatch[1]) this._stat = { size: parseInt(sizeMatch[1], 10) }

      return nodeBuffer
    }
    throw new Error(`HTTP ${response.status} fetching ${this.url}`)
  }

  read(buffer, offset = 0, length = Infinity, position = 0) {
    let readPosition = position
    if (readPosition === null) {
      readPosition = this.position
      this.position += length
    }
    return this.cache.get(buffer, offset, length, position)
  }

  async readFile() {
    const response = await fetch(this.url, {
      method: 'GET',
      redirect: 'follow',
      mode: 'cors',
    })
    return Buffer.from(await response.arrayBuffer())
  }

  async stat() {
    if (!this._stat) {
      const buf = Buffer.allocUnsafe(10)
      await this.read(buf, 0, 10, 0)
      if (!this._stat)
        throw new Error(`unable to determin size of file at ${this.url}`)
    }
    return this._stat
  }
}

module.exports = RemoteFile

