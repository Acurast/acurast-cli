import path from 'path'
import { getDirectoryFromFilePath } from '../src/util/getDirectoryFromFilePath.js'

describe('getDirectoryFromFilePath', () => {
  test('should convert nested dirs', () => {
    const data = [
      {
        dir: './.acurast',
        expected: path.normalize('./.acurast'),
      },
      {
        dir: './.acurast/deploy',
        expected: path.normalize('./.acurast/deploy'),
      },
      {
        dir: './.acurast/deploy/',
        expected: path.normalize('./.acurast/deploy/'),
      },
      {
        dir: './.acurast/keys.json',
        expected: path.normalize('./.acurast'),
      },
      {
        dir: './.acurast/deploy/1.json',
        expected: path.normalize('./.acurast/deploy'),
      },
    ]

    for (const { dir, expected } of data) {
      expect(getDirectoryFromFilePath(dir)).toEqual(expected)
    }
  })
})
