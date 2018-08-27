const fs =
  // eslint-disable-next-line camelcase
  typeof __webpack_require__ !== 'function' ? require('fs-extra') : undefined

function _faiOffset(idx, pos) {
  return (
    idx.offset +
    idx.lineBytes * Math.floor(pos / idx.lineLength) +
    (pos % idx.lineLength)
  )
}

class LocalFile {
  constructor(path) {
    this.fdPromise = fs.open(path, 'r')
  }

  async read(buf, offset, length, position) {
    const fd = await this.fdPromise
    await fs.read(fd, buf, offset, length, position)
  }
  async readFile() {
    const fd = await this.fdPromise
    return fs.readFile(fd)
  }
}

class IndexedFasta {
  constructor({ fasta, fai, path, faiPath, chunkSizeLimit = 100000 }) {
    if (fasta) {
      this.fasta = fasta
    } else if (path) {
      this.fasta = new LocalFile(path)
    }

    if (fai) {
      this.fai = fai
    } else if (faiPath) {
      this.fai = new LocalFile(faiPath)
    } else if (path) {
      this.fai = new LocalFile(`${path}.fai`)
    }
    this.chunkSizeLimit = chunkSizeLimit
  }

  async _getIndexes() {
    if (!this.indexes) this.indexes = await this._readFAI()
    return this.indexes
  }

  async _readFAI() {
    const indexByName = {}
    const indexById = {}
    const text = await this.fai.readFile()
    if (!(text && text.length))
      throw new Error('No data read from FASTA index (FAI) file')

    let idCounter = 0
    let currSeq
    text
      .toString('utf8')
      .split(/\r?\n/)
      .filter(line => /\S/.test(line))
      .forEach(line => {
        const row = line.split('\t')
        if (row[0] === '') return

        if (!currSeq || currSeq.name !== row[0]) {
          currSeq = { name: row[0], id: idCounter }
          idCounter += 1
        }

        const entry = {
          id: currSeq.id,
          name: row[0],
          length: +row[1],
          start: 0,
          end: +row[1],
          offset: +row[2],
          lineLength: +row[3],
          lineBytes: +row[4],
        }
        indexByName[entry.name] = entry
        indexById[entry.id] = entry
      })

    return { name: indexByName, id: indexById }
  }

  /**
   * @returns {array[string]} array of string sequence
   * names that are present in the index, in which the
   * array index indicates the sequence ID, and the value
   * is the sequence name
   */
  async getSequenceList() {
    return Object.entries((await this._getIndexes()).id).map(
      ([key, value]) => value.name, // eslint-disable-line no-unused-vars
    )
  }

  /**
   * @returns {array[string]} array of string sequence
   * names that are present in the index, in which the
   * array index indicates the sequence ID, and the value
   * is the sequence name
   */
  async getSequenceNames() {
    return Object.keys((await this._getIndexes()).id)
  }
  /**
   * @returns {array[string]} array of string sequence
   * names that are present in the index, in which the
   * array index indicates the sequence ID, and the value
   * is the sequence name
   */
  async getSequenceSizes() {
    const returnObject = {}
    Object.entries((await this._getIndexes()).id).map(
      // eslint-disable-next-line no-unused-vars
      ([key, value]) => {
        returnObject[value.name] = value.length
      }
    )
    return returnObject
  }

  /**
   * @returns {array[string]} array of string sequence
   * names that are present in the index, in which the
   * array index indicates the sequence ID, and the value
   * is the sequence name
   */
  async getSequenceSize(seqName) {
    const idx = await this._getIndexes()
    return idx.name[seqName].length
  }

  /**
   *
   * @param {string} name
   * @returns {Promise[boolean]} true if the file contains the given reference sequence name
   */
  async hasReferenceSequence(name) {
    return !!(await this._getIndexes()).name[name]
  }

  /**
   *
   * @param {number} seqId
   * @param {number} min
   * @param {number} max
   */
  async getResiduesById(seqId, min, max) {
    const indexEntry = (await this._getIndexes()).id[seqId]
    if (!indexEntry) return undefined
    return this._fetchFromIndexEntry(indexEntry, min, max)
  }

  /**
   * @param {string} seqName
   * @param {number} min
   * @param {number} max
   */
  async getResiduesByName(seqName, min, max) {
    const indexEntry = (await this._getIndexes()).name[seqName]
    if (!indexEntry) return undefined
    return this._fetchFromIndexEntry(indexEntry, min, max)
  }
  async getSequence(seqName, min, max) {
    return this.getResiduesByName(...arguments)
  }

  async _fetchFromIndexEntry(indexEntry, min = 0, max) {
    let end = max
    if (min < 0) {
      throw new TypeError('regionStart cannot be less than 0')
    }
    if (end === undefined || end > indexEntry.length) {
      end = indexEntry.length
    }

    const position = _faiOffset(indexEntry, min)
    const readlen = _faiOffset(indexEntry, end) - position

    if (readlen > this.chunkSizeLimit)
      throw new Error('chunkSizeLimit exceeded')

    let residues = Buffer.allocUnsafe(readlen)
    await this.fasta.read(residues, 0, readlen, position)
    residues = residues.toString('utf8').replace(/\s+/g, '')

    return residues
  }
}

module.exports = IndexedFasta
