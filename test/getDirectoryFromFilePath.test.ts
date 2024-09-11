import { getDirectoryFromFilePath } from '../src/util/getDirectoryFromFilePath.js'

describe('getDirectoryFromFilePath', () => {
  test('should convert nested dirs', () => {
    const data = [
      {
        dir: './.acurast',
        expected: './.acurast',
      },
      {
        dir: './.acurast/deploy',
        expected: './.acurast/deploy',
      },
      {
        dir: './.acurast/deploy/',
        expected: './.acurast/deploy/',
      },
      {
        dir: './.acurast/keys.json',
        expected: './.acurast',
      },
      {
        dir: './.acurast/deploy/1.json',
        expected: './.acurast/deploy',
      },
    ]

    for (const { dir, expected } of data) {
      expect(getDirectoryFromFilePath(dir)).toEqual(expected)
    }
  })
})
