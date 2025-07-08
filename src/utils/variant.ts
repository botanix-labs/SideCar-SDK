
function bigintToSmallEndian(
    value: bigint,
    length: number,
    buffer: Buffer,
    offset: number,
  ): void {
    for (let i = 0; i < length; i++) {
      if (buffer[i + offset] == undefined) {
        throw Error('Buffer too small')
      }
      buffer[i + offset] = Number(value % BigInt(256))
      value = value >> BigInt(8)
    }
  }
  
  function smallEndianToBigint(
    buffer: Buffer,
    offset: number,
    length: number,
  ): bigint {
    let result = BigInt(0)
    for (let i = 0; i < length; i++) {
      if (buffer[i + offset] == null) {
        throw Error('Buffer too small')
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      result += BigInt(buffer[i + offset]) << BigInt(i * 8)
    }
    return result
  }

  /**
 * Converts a `bigint` to a `number` if it non-negative and at most MAX_SAFE_INTEGER; throws `RangeError` otherwise.
 * Used when converting a Bitcoin-style varint to a `number`, since varints could be larger than what the `Number`
 * class can represent without loss of precision.
 *
 * @param n the number to convert
 * @returns `n` as a `number`
 */
export function sanitizeBigintToNumber(n: number | bigint): number {
    if (n < 0) throw RangeError('Negative bigint is not a valid varint')
    if (n > Number.MAX_SAFE_INTEGER) throw RangeError('Too large for a Number')
  
    return Number(n)
  }
  
  function getVarintSize(value: number | bigint): 1 | 3 | 5 | 9 {
    if (typeof value == 'number') {
      value = sanitizeBigintToNumber(value)
    }
  
    if (value < BigInt(0)) {
      throw new RangeError('Negative numbers are not supported')
    }
  
    if (value >= BigInt(1) << BigInt(64)) {
      throw new RangeError('Too large for a Bitcoin-style varint')
    }
  
    if (value < BigInt(0xfd)) return 1
    else if (value <= BigInt(0xffff)) return 3
    else if (value <= BigInt(0xffffffff)) return 5
    else return 9
  }
  
  /**
   * Write a variable integer to a buffer
   * @param num Number to write
   * @returns Buffer containing the varint
   */
  export function createVarint(value: number | bigint): Buffer {
    if (typeof value == 'number') {
      value = sanitizeBigintToNumber(value)
    }
  
    const size = getVarintSize(value)
  
    value = BigInt(value)
  
    const buffer = Buffer.alloc(size)
    if (size == 1) {
      buffer[0] = Number(value)
    } else {
      if (size == 3) buffer[0] = 0xfd
      else if (size === 5) buffer[0] = 0xfe
      else buffer[0] = 0xff
  
      bigintToSmallEndian(value, size - 1, buffer, 1)
    }
    return buffer
  }
