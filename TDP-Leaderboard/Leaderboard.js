module.exports = class Leaderboard {
  constructor(recordsByLevel) {
    this.recordsByLevel = recordsByLevel || {};
    this.userRecordsByLevel = {};
  }
  addSorted(levelRecord, record) {
    if (levelRecord.length === 0) {
      levelRecord.push(record);
      return 0;
    } else {
      let times = levelRecord.map(r => r.time)
      let index = binarySearchRight(times, record.time);
      if (index === times.length) {
        levelRecord.push(record);
      } else {
        levelRecord.splice(index, 0, record);
      }
      return index;
    }
  }
  addRecord(level, record) {
    return addSorted(this.recordsByLevel[level])
  }
}