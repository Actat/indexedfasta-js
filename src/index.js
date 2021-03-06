const RemoteFile = require('./remoteFile')
const LocalFile = require('./localFile')
const BgzipIndexedFasta = require('./bgzipIndexedFasta')
const IndexedFasta = require('./indexedFasta')

function parseSmallFasta(text) {
  return text
    .split('>')
    .filter(t => /\S/.test(t))
    .map(entryText => {
      const [defLine, ...seqLines] = entryText.split('\n')
      const [id, ...description] = defLine.split(' ')
      const sequence = seqLines.join('').replace(/\s/g, '')
      return {
        id,
        description: description.join(' '),
        sequence,
      }
    })
}
// memoized
class FetchableSmallFasta {
  constructor({ fasta, path }) {
    if (fasta) {
      this.fasta = fasta
    } else if (path) {
      this.fasta = new LocalFile(path)
    }
    this.data = this.fasta.readFile().then(buffer => {
      const text = buffer.toString('utf8')
      return parseSmallFasta(text)
    })
  }

  async fetch(id, start, end) {
    const data = await this.data
    const entry = data.find(iter => iter.id === id)
    const length = end - start
    if (!entry) throw new Error(`no sequence with id ${id} exists`)
    return entry.sequence.substr(start, length)
  }

  async getSequenceList() {
    const data = await this.data
    return data.map(entry => entry.id)
  }
}

module.exports = { parseSmallFasta: parseSmallFasta, FetchableSmallFasta: FetchableSmallFasta, IndexedFasta: IndexedFasta, BgzipIndexedFasta: BgzipIndexedFasta }
