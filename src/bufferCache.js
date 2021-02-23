/*!
 * bufferCache.js from cram-js (https://github.com/GMOD/cram-js)
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

const LRU = require('quick-lru')

class BufferCache {
  constructor({ fetch, size = 10000000, chunkSize = 32768 }) {
    if (!fetch) throw new Error('fetch funcitno required')
    this.fetch = fetch
    this.chunkSize = chunkSize
    this.lruCache = new LRU({ maxSize: Math.floor(size / chunkSize) })
  }

  async get(outputBuffer, offset, length, position) {
    if (outputBuffer.length < offset + length)
      throw new Error('output buffer not big enough for request')

    // calculate the list of chunks involved in this fetch
    const firstChunk = Math.floor(position / this.chunkSize)
    const lastChunk = Math.floor((position + length) / this.chunkSize)

    // fetch them all as necessary
    const fetches = new Array(lastChunk - firstChunk + 1)
    for (let chunk = firstChunk; chunk <= lastChunk; chunk += 1) {
      fetches[chunk - firstChunk] = this._getChunk(chunk).then(data => ({
        data,
        chunkNumber: chunk,
      }))
    }

    // stitch together the response buffer using them
    const chunks = await Promise.all(fetches)
    const chunksOffset = position - chunks[0].chunkNumber * this.chunkSize
    chunks.forEach(({ data, chunkNumber }) => {
      const chunkPositionStart = chunkNumber * this.chunkSize
      let copyStart = 0
      let copyEnd = this.chunkSize
      let copyOffset =
        offset + (chunkNumber - firstChunk) * this.chunkSize - chunksOffset

      if (chunkNumber === firstChunk) {
        copyOffset = offset
        copyStart = chunksOffset
      }
      if (chunkNumber === lastChunk) {
        copyEnd = position + length - chunkPositionStart
      }

      data.copy(outputBuffer, copyOffset, copyStart, copyEnd)
    })
  }

  _getChunk(chunkNumber) {
    const cachedPromise = this.lruCache.get(chunkNumber)
    if (cachedPromise) return cachedPromise

    const freshPromise = this.fetch(
      chunkNumber * this.chunkSize,
      this.chunkSize,
    )
    this.lruCache.set(chunkNumber, freshPromise)
    return freshPromise
  }
}
module.exports = BufferCache

