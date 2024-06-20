import process from 'node:process'
import cliCursor from 'cli-cursor'
import logSymbols from 'log-symbols'
import stripAnsi from 'strip-ansi'
import stringWidth from 'string-width'
import isInteractive from 'is-interactive'
import isUnicodeSupported from 'is-unicode-supported'
import stdinDiscarder from 'stdin-discarder'
import { acurastColor } from '../util.js'

const cliSpinners = {
  dots: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
  dots2: {
    interval: 80,
    frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  },
  dots3: {
    interval: 80,
    frames: ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'],
  },
  dots4: {
    interval: 80,
    frames: [
      '⠄',
      '⠆',
      '⠇',
      '⠋',
      '⠙',
      '⠸',
      '⠰',
      '⠠',
      '⠰',
      '⠸',
      '⠙',
      '⠋',
      '⠇',
      '⠆',
    ],
  },
  dots5: {
    interval: 80,
    frames: [
      '⠋',
      '⠙',
      '⠚',
      '⠒',
      '⠂',
      '⠂',
      '⠒',
      '⠲',
      '⠴',
      '⠦',
      '⠖',
      '⠒',
      '⠐',
      '⠐',
      '⠒',
      '⠓',
      '⠋',
    ],
  },
  dots6: {
    interval: 80,
    frames: [
      '⠁',
      '⠉',
      '⠙',
      '⠚',
      '⠒',
      '⠂',
      '⠂',
      '⠒',
      '⠲',
      '⠴',
      '⠤',
      '⠄',
      '⠄',
      '⠤',
      '⠴',
      '⠲',
      '⠒',
      '⠂',
      '⠂',
      '⠒',
      '⠚',
      '⠙',
      '⠉',
      '⠁',
    ],
  },
  dots7: {
    interval: 80,
    frames: [
      '⠈',
      '⠉',
      '⠋',
      '⠓',
      '⠒',
      '⠐',
      '⠐',
      '⠒',
      '⠖',
      '⠦',
      '⠤',
      '⠠',
      '⠠',
      '⠤',
      '⠦',
      '⠖',
      '⠒',
      '⠐',
      '⠐',
      '⠒',
      '⠓',
      '⠋',
      '⠉',
      '⠈',
    ],
  },
  dots8: {
    interval: 80,
    frames: [
      '⠁',
      '⠁',
      '⠉',
      '⠙',
      '⠚',
      '⠒',
      '⠂',
      '⠂',
      '⠒',
      '⠲',
      '⠴',
      '⠤',
      '⠄',
      '⠄',
      '⠤',
      '⠠',
      '⠠',
      '⠤',
      '⠦',
      '⠖',
      '⠒',
      '⠐',
      '⠐',
      '⠒',
      '⠓',
      '⠋',
      '⠉',
      '⠈',
      '⠈',
    ],
  },
  dots9: {
    interval: 80,
    frames: ['⢹', '⢺', '⢼', '⣸', '⣇', '⡧', '⡗', '⡏'],
  },
  dots10: {
    interval: 80,
    frames: ['⢄', '⢂', '⢁', '⡁', '⡈', '⡐', '⡠'],
  },
  dots11: {
    interval: 100,
    frames: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  },
  dots12: {
    interval: 80,
    frames: [
      '⢀⠀',
      '⡀⠀',
      '⠄⠀',
      '⢂⠀',
      '⡂⠀',
      '⠅⠀',
      '⢃⠀',
      '⡃⠀',
      '⠍⠀',
      '⢋⠀',
      '⡋⠀',
      '⠍⠁',
      '⢋⠁',
      '⡋⠁',
      '⠍⠉',
      '⠋⠉',
      '⠋⠉',
      '⠉⠙',
      '⠉⠙',
      '⠉⠩',
      '⠈⢙',
      '⠈⡙',
      '⢈⠩',
      '⡀⢙',
      '⠄⡙',
      '⢂⠩',
      '⡂⢘',
      '⠅⡘',
      '⢃⠨',
      '⡃⢐',
      '⠍⡐',
      '⢋⠠',
      '⡋⢀',
      '⠍⡁',
      '⢋⠁',
      '⡋⠁',
      '⠍⠉',
      '⠋⠉',
      '⠋⠉',
      '⠉⠙',
      '⠉⠙',
      '⠉⠩',
      '⠈⢙',
      '⠈⡙',
      '⠈⠩',
      '⠀⢙',
      '⠀⡙',
      '⠀⠩',
      '⠀⢘',
      '⠀⡘',
      '⠀⠨',
      '⠀⢐',
      '⠀⡐',
      '⠀⠠',
      '⠀⢀',
      '⠀⡀',
    ],
  },
  dots13: {
    interval: 80,
    frames: ['⣼', '⣹', '⢻', '⠿', '⡟', '⣏', '⣧', '⣶'],
  },
  dots8Bit: {
    interval: 80,
    frames: [
      '⠀',
      '⠁',
      '⠂',
      '⠃',
      '⠄',
      '⠅',
      '⠆',
      '⠇',
      '⡀',
      '⡁',
      '⡂',
      '⡃',
      '⡄',
      '⡅',
      '⡆',
      '⡇',
      '⠈',
      '⠉',
      '⠊',
      '⠋',
      '⠌',
      '⠍',
      '⠎',
      '⠏',
      '⡈',
      '⡉',
      '⡊',
      '⡋',
      '⡌',
      '⡍',
      '⡎',
      '⡏',
      '⠐',
      '⠑',
      '⠒',
      '⠓',
      '⠔',
      '⠕',
      '⠖',
      '⠗',
      '⡐',
      '⡑',
      '⡒',
      '⡓',
      '⡔',
      '⡕',
      '⡖',
      '⡗',
      '⠘',
      '⠙',
      '⠚',
      '⠛',
      '⠜',
      '⠝',
      '⠞',
      '⠟',
      '⡘',
      '⡙',
      '⡚',
      '⡛',
      '⡜',
      '⡝',
      '⡞',
      '⡟',
      '⠠',
      '⠡',
      '⠢',
      '⠣',
      '⠤',
      '⠥',
      '⠦',
      '⠧',
      '⡠',
      '⡡',
      '⡢',
      '⡣',
      '⡤',
      '⡥',
      '⡦',
      '⡧',
      '⠨',
      '⠩',
      '⠪',
      '⠫',
      '⠬',
      '⠭',
      '⠮',
      '⠯',
      '⡨',
      '⡩',
      '⡪',
      '⡫',
      '⡬',
      '⡭',
      '⡮',
      '⡯',
      '⠰',
      '⠱',
      '⠲',
      '⠳',
      '⠴',
      '⠵',
      '⠶',
      '⠷',
      '⡰',
      '⡱',
      '⡲',
      '⡳',
      '⡴',
      '⡵',
      '⡶',
      '⡷',
      '⠸',
      '⠹',
      '⠺',
      '⠻',
      '⠼',
      '⠽',
      '⠾',
      '⠿',
      '⡸',
      '⡹',
      '⡺',
      '⡻',
      '⡼',
      '⡽',
      '⡾',
      '⡿',
      '⢀',
      '⢁',
      '⢂',
      '⢃',
      '⢄',
      '⢅',
      '⢆',
      '⢇',
      '⣀',
      '⣁',
      '⣂',
      '⣃',
      '⣄',
      '⣅',
      '⣆',
      '⣇',
      '⢈',
      '⢉',
      '⢊',
      '⢋',
      '⢌',
      '⢍',
      '⢎',
      '⢏',
      '⣈',
      '⣉',
      '⣊',
      '⣋',
      '⣌',
      '⣍',
      '⣎',
      '⣏',
      '⢐',
      '⢑',
      '⢒',
      '⢓',
      '⢔',
      '⢕',
      '⢖',
      '⢗',
      '⣐',
      '⣑',
      '⣒',
      '⣓',
      '⣔',
      '⣕',
      '⣖',
      '⣗',
      '⢘',
      '⢙',
      '⢚',
      '⢛',
      '⢜',
      '⢝',
      '⢞',
      '⢟',
      '⣘',
      '⣙',
      '⣚',
      '⣛',
      '⣜',
      '⣝',
      '⣞',
      '⣟',
      '⢠',
      '⢡',
      '⢢',
      '⢣',
      '⢤',
      '⢥',
      '⢦',
      '⢧',
      '⣠',
      '⣡',
      '⣢',
      '⣣',
      '⣤',
      '⣥',
      '⣦',
      '⣧',
      '⢨',
      '⢩',
      '⢪',
      '⢫',
      '⢬',
      '⢭',
      '⢮',
      '⢯',
      '⣨',
      '⣩',
      '⣪',
      '⣫',
      '⣬',
      '⣭',
      '⣮',
      '⣯',
      '⢰',
      '⢱',
      '⢲',
      '⢳',
      '⢴',
      '⢵',
      '⢶',
      '⢷',
      '⣰',
      '⣱',
      '⣲',
      '⣳',
      '⣴',
      '⣵',
      '⣶',
      '⣷',
      '⢸',
      '⢹',
      '⢺',
      '⢻',
      '⢼',
      '⢽',
      '⢾',
      '⢿',
      '⣸',
      '⣹',
      '⣺',
      '⣻',
      '⣼',
      '⣽',
      '⣾',
      '⣿',
    ],
  },
  sand: {
    interval: 80,
    frames: [
      '⠁',
      '⠂',
      '⠄',
      '⡀',
      '⡈',
      '⡐',
      '⡠',
      '⣀',
      '⣁',
      '⣂',
      '⣄',
      '⣌',
      '⣔',
      '⣤',
      '⣥',
      '⣦',
      '⣮',
      '⣶',
      '⣷',
      '⣿',
      '⡿',
      '⠿',
      '⢟',
      '⠟',
      '⡛',
      '⠛',
      '⠫',
      '⢋',
      '⠋',
      '⠍',
      '⡉',
      '⠉',
      '⠑',
      '⠡',
      '⢁',
    ],
  },
  line: {
    interval: 130,
    frames: ['-', '\\', '|', '/'],
  },
  line2: {
    interval: 100,
    frames: ['⠂', '-', '–', '—', '–', '-'],
  },
  pipe: {
    interval: 100,
    frames: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'],
  },
  simpleDots: {
    interval: 400,
    frames: ['.  ', '.. ', '...', '   '],
  },
  simpleDotsScrolling: {
    interval: 200,
    frames: ['.  ', '.. ', '...', ' ..', '  .', '   '],
  },
  star: {
    interval: 70,
    frames: ['✶', '✸', '✹', '✺', '✹', '✷'],
  },
  star2: {
    interval: 80,
    frames: ['+', 'x', '*'],
  },
  flip: {
    interval: 70,
    frames: ['_', '_', '_', '-', '`', '`', "'", '´', '-', '_', '_', '_'],
  },
  hamburger: {
    interval: 100,
    frames: ['☱', '☲', '☴'],
  },
  growVertical: {
    interval: 120,
    frames: ['▁', '▃', '▄', '▅', '▆', '▇', '▆', '▅', '▄', '▃'],
  },
  growHorizontal: {
    interval: 120,
    frames: ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'],
  },
  balloon: {
    interval: 140,
    frames: [' ', '.', 'o', 'O', '@', '*', ' '],
  },
  balloon2: {
    interval: 120,
    frames: ['.', 'o', 'O', '°', 'O', 'o', '.'],
  },
  noise: {
    interval: 100,
    frames: ['▓', '▒', '░'],
  },
  bounce: {
    interval: 120,
    frames: ['⠁', '⠂', '⠄', '⠂'],
  },
  boxBounce: {
    interval: 120,
    frames: ['▖', '▘', '▝', '▗'],
  },
  boxBounce2: {
    interval: 100,
    frames: ['▌', '▀', '▐', '▄'],
  },
  triangle: {
    interval: 50,
    frames: ['◢', '◣', '◤', '◥'],
  },
  binary: {
    interval: 80,
    frames: [
      '010010',
      '001100',
      '100101',
      '111010',
      '111101',
      '010111',
      '101011',
      '111000',
      '110011',
      '110101',
    ],
  },
  arc: {
    interval: 100,
    frames: ['◜', '◠', '◝', '◞', '◡', '◟'],
  },
  circle: {
    interval: 120,
    frames: ['◡', '⊙', '◠'],
  },
  squareCorners: {
    interval: 180,
    frames: ['◰', '◳', '◲', '◱'],
  },
  circleQuarters: {
    interval: 120,
    frames: ['◴', '◷', '◶', '◵'],
  },
  circleHalves: {
    interval: 50,
    frames: ['◐', '◓', '◑', '◒'],
  },
  squish: {
    interval: 100,
    frames: ['╫', '╪'],
  },
  toggle: {
    interval: 250,
    frames: ['⊶', '⊷'],
  },
  toggle2: {
    interval: 80,
    frames: ['▫', '▪'],
  },
  toggle3: {
    interval: 120,
    frames: ['□', '■'],
  },
  toggle4: {
    interval: 100,
    frames: ['■', '□', '▪', '▫'],
  },
  toggle5: {
    interval: 100,
    frames: ['▮', '▯'],
  },
  toggle6: {
    interval: 300,
    frames: ['ဝ', '၀'],
  },
  toggle7: {
    interval: 80,
    frames: ['⦾', '⦿'],
  },
  toggle8: {
    interval: 100,
    frames: ['◍', '◌'],
  },
  toggle9: {
    interval: 100,
    frames: ['◉', '◎'],
  },
  toggle10: {
    interval: 100,
    frames: ['㊂', '㊀', '㊁'],
  },
  toggle11: {
    interval: 50,
    frames: ['⧇', '⧆'],
  },
  toggle12: {
    interval: 120,
    frames: ['☗', '☖'],
  },
  toggle13: {
    interval: 80,
    frames: ['=', '*', '-'],
  },
  arrow: {
    interval: 100,
    frames: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  },
  arrow2: {
    interval: 80,
    frames: ['⬆️ ', '↗️ ', '➡️ ', '↘️ ', '⬇️ ', '↙️ ', '⬅️ ', '↖️ '],
  },
  arrow3: {
    interval: 120,
    frames: ['▹▹▹▹▹', '▸▹▹▹▹', '▹▸▹▹▹', '▹▹▸▹▹', '▹▹▹▸▹', '▹▹▹▹▸'],
  },
  bouncingBar: {
    interval: 80,
    frames: [
      '[    ]',
      '[=   ]',
      '[==  ]',
      '[=== ]',
      '[====]',
      '[ ===]',
      '[  ==]',
      '[   =]',
      '[    ]',
      '[   =]',
      '[  ==]',
      '[ ===]',
      '[====]',
      '[=== ]',
      '[==  ]',
      '[=   ]',
    ],
  },
  bouncingBall: {
    interval: 80,
    frames: [
      '( ●    )',
      '(  ●   )',
      '(   ●  )',
      '(    ● )',
      '(     ●)',
      '(    ● )',
      '(   ●  )',
      '(  ●   )',
      '( ●    )',
      '(●     )',
    ],
  },
  smiley: {
    interval: 200,
    frames: ['😄 ', '😝 '],
  },
  monkey: {
    interval: 300,
    frames: ['🙈 ', '🙈 ', '🙉 ', '🙊 '],
  },
  hearts: {
    interval: 100,
    frames: ['💛 ', '💙 ', '💜 ', '💚 ', '❤️ '],
  },
  clock: {
    interval: 100,
    frames: [
      '🕛 ',
      '🕐 ',
      '🕑 ',
      '🕒 ',
      '🕓 ',
      '🕔 ',
      '🕕 ',
      '🕖 ',
      '🕗 ',
      '🕘 ',
      '🕙 ',
      '🕚 ',
    ],
  },
  earth: {
    interval: 180,
    frames: ['🌍 ', '🌎 ', '🌏 '],
  },
  material: {
    interval: 17,
    frames: [
      '█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '███▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '████▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '███████▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '████████▁▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '██████████▁▁▁▁▁▁▁▁▁▁',
      '███████████▁▁▁▁▁▁▁▁▁',
      '█████████████▁▁▁▁▁▁▁',
      '██████████████▁▁▁▁▁▁',
      '██████████████▁▁▁▁▁▁',
      '▁██████████████▁▁▁▁▁',
      '▁██████████████▁▁▁▁▁',
      '▁██████████████▁▁▁▁▁',
      '▁▁██████████████▁▁▁▁',
      '▁▁▁██████████████▁▁▁',
      '▁▁▁▁█████████████▁▁▁',
      '▁▁▁▁██████████████▁▁',
      '▁▁▁▁██████████████▁▁',
      '▁▁▁▁▁██████████████▁',
      '▁▁▁▁▁██████████████▁',
      '▁▁▁▁▁██████████████▁',
      '▁▁▁▁▁▁██████████████',
      '▁▁▁▁▁▁██████████████',
      '▁▁▁▁▁▁▁█████████████',
      '▁▁▁▁▁▁▁█████████████',
      '▁▁▁▁▁▁▁▁████████████',
      '▁▁▁▁▁▁▁▁████████████',
      '▁▁▁▁▁▁▁▁▁███████████',
      '▁▁▁▁▁▁▁▁▁███████████',
      '▁▁▁▁▁▁▁▁▁▁██████████',
      '▁▁▁▁▁▁▁▁▁▁██████████',
      '▁▁▁▁▁▁▁▁▁▁▁▁████████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁███████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁██████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████',
      '█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████',
      '██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███',
      '██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███',
      '███▁▁▁▁▁▁▁▁▁▁▁▁▁▁███',
      '████▁▁▁▁▁▁▁▁▁▁▁▁▁▁██',
      '█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '██████▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '████████▁▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '█████████▁▁▁▁▁▁▁▁▁▁▁',
      '███████████▁▁▁▁▁▁▁▁▁',
      '████████████▁▁▁▁▁▁▁▁',
      '████████████▁▁▁▁▁▁▁▁',
      '██████████████▁▁▁▁▁▁',
      '██████████████▁▁▁▁▁▁',
      '▁██████████████▁▁▁▁▁',
      '▁██████████████▁▁▁▁▁',
      '▁▁▁█████████████▁▁▁▁',
      '▁▁▁▁▁████████████▁▁▁',
      '▁▁▁▁▁████████████▁▁▁',
      '▁▁▁▁▁▁███████████▁▁▁',
      '▁▁▁▁▁▁▁▁█████████▁▁▁',
      '▁▁▁▁▁▁▁▁█████████▁▁▁',
      '▁▁▁▁▁▁▁▁▁█████████▁▁',
      '▁▁▁▁▁▁▁▁▁█████████▁▁',
      '▁▁▁▁▁▁▁▁▁▁█████████▁',
      '▁▁▁▁▁▁▁▁▁▁▁████████▁',
      '▁▁▁▁▁▁▁▁▁▁▁████████▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁███████▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁███████▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁███████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁███████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
      '▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁',
    ],
  },
  moon: {
    interval: 80,
    frames: ['🌑 ', '🌒 ', '🌓 ', '🌔 ', '🌕 ', '🌖 ', '🌗 ', '🌘 '],
  },
  runner: {
    interval: 140,
    frames: ['🚶 ', '🏃 '],
  },
  pong: {
    interval: 80,
    frames: [
      '▐⠂       ▌',
      '▐⠈       ▌',
      '▐ ⠂      ▌',
      '▐ ⠠      ▌',
      '▐  ⡀     ▌',
      '▐  ⠠     ▌',
      '▐   ⠂    ▌',
      '▐   ⠈    ▌',
      '▐    ⠂   ▌',
      '▐    ⠠   ▌',
      '▐     ⡀  ▌',
      '▐     ⠠  ▌',
      '▐      ⠂ ▌',
      '▐      ⠈ ▌',
      '▐       ⠂▌',
      '▐       ⠠▌',
      '▐       ⡀▌',
      '▐      ⠠ ▌',
      '▐      ⠂ ▌',
      '▐     ⠈  ▌',
      '▐     ⠂  ▌',
      '▐    ⠠   ▌',
      '▐    ⡀   ▌',
      '▐   ⠠    ▌',
      '▐   ⠂    ▌',
      '▐  ⠈     ▌',
      '▐  ⠂     ▌',
      '▐ ⠠      ▌',
      '▐ ⡀      ▌',
      '▐⠠       ▌',
    ],
  },
  shark: {
    interval: 120,
    frames: [
      '▐|\\____________▌',
      '▐_|\\___________▌',
      '▐__|\\__________▌',
      '▐___|\\_________▌',
      '▐____|\\________▌',
      '▐_____|\\_______▌',
      '▐______|\\______▌',
      '▐_______|\\_____▌',
      '▐________|\\____▌',
      '▐_________|\\___▌',
      '▐__________|\\__▌',
      '▐___________|\\_▌',
      '▐____________|\\▌',
      '▐____________/|▌',
      '▐___________/|_▌',
      '▐__________/|__▌',
      '▐_________/|___▌',
      '▐________/|____▌',
      '▐_______/|_____▌',
      '▐______/|______▌',
      '▐_____/|_______▌',
      '▐____/|________▌',
      '▐___/|_________▌',
      '▐__/|__________▌',
      '▐_/|___________▌',
      '▐/|____________▌',
    ],
  },
  dqpb: {
    interval: 100,
    frames: ['d', 'q', 'p', 'b'],
  },
  weather: {
    interval: 100,
    frames: [
      '☀️ ',
      '☀️ ',
      '☀️ ',
      '🌤 ',
      '⛅️ ',
      '🌥 ',
      '☁️ ',
      '🌧 ',
      '🌨 ',
      '🌧 ',
      '🌨 ',
      '🌧 ',
      '🌨 ',
      '⛈ ',
      '🌨 ',
      '🌧 ',
      '🌨 ',
      '☁️ ',
      '🌥 ',
      '⛅️ ',
      '🌤 ',
      '☀️ ',
      '☀️ ',
    ],
  },
  christmas: {
    interval: 400,
    frames: ['🌲', '🎄'],
  },
  grenade: {
    interval: 80,
    frames: [
      '،  ',
      '′  ',
      ' ´ ',
      ' ‾ ',
      '  ⸌',
      '  ⸊',
      '  |',
      '  ⁎',
      '  ⁕',
      ' ෴ ',
      '  ⁓',
      '   ',
      '   ',
      '   ',
    ],
  },
  point: {
    interval: 125,
    frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'],
  },
  layer: {
    interval: 150,
    frames: ['-', '=', '≡'],
  },
  betaWave: {
    interval: 80,
    frames: [
      'ρββββββ',
      'βρβββββ',
      'ββρββββ',
      'βββρβββ',
      'ββββρββ',
      'βββββρβ',
      'ββββββρ',
    ],
  },
  fingerDance: {
    interval: 160,
    frames: ['🤘 ', '🤟 ', '🖖 ', '✋ ', '🤚 ', '👆 '],
  },
  fistBump: {
    interval: 80,
    frames: [
      '🤜\u3000\u3000\u3000\u3000🤛 ',
      '🤜\u3000\u3000\u3000\u3000🤛 ',
      '🤜\u3000\u3000\u3000\u3000🤛 ',
      '\u3000🤜\u3000\u3000🤛\u3000 ',
      '\u3000\u3000🤜🤛\u3000\u3000 ',
      '\u3000🤜✨🤛\u3000\u3000 ',
      '🤜\u3000✨\u3000🤛\u3000 ',
    ],
  },
  soccerHeader: {
    interval: 80,
    frames: [
      ' 🧑⚽️       🧑 ',
      '🧑  ⚽️      🧑 ',
      '🧑   ⚽️     🧑 ',
      '🧑    ⚽️    🧑 ',
      '🧑     ⚽️   🧑 ',
      '🧑      ⚽️  🧑 ',
      '🧑       ⚽️🧑  ',
      '🧑      ⚽️  🧑 ',
      '🧑     ⚽️   🧑 ',
      '🧑    ⚽️    🧑 ',
      '🧑   ⚽️     🧑 ',
      '🧑  ⚽️      🧑 ',
    ],
  },
  mindblown: {
    interval: 160,
    frames: [
      '😐 ',
      '😐 ',
      '😮 ',
      '😮 ',
      '😦 ',
      '😦 ',
      '😧 ',
      '😧 ',
      '🤯 ',
      '💥 ',
      '✨ ',
      '\u3000 ',
      '\u3000 ',
      '\u3000 ',
    ],
  },
  speaker: {
    interval: 160,
    frames: ['🔈 ', '🔉 ', '🔊 ', '🔉 '],
  },
  orangePulse: {
    interval: 100,
    frames: ['🔸 ', '🔶 ', '🟠 ', '🟠 ', '🔶 '],
  },
  bluePulse: {
    interval: 100,
    frames: ['🔹 ', '🔷 ', '🔵 ', '🔵 ', '🔷 '],
  },
  orangeBluePulse: {
    interval: 100,
    frames: [
      '🔸 ',
      '🔶 ',
      '🟠 ',
      '🟠 ',
      '🔶 ',
      '🔹 ',
      '🔷 ',
      '🔵 ',
      '🔵 ',
      '🔷 ',
    ],
  },
  timeTravel: {
    interval: 100,
    frames: [
      '🕛 ',
      '🕚 ',
      '🕙 ',
      '🕘 ',
      '🕗 ',
      '🕖 ',
      '🕕 ',
      '🕔 ',
      '🕓 ',
      '🕒 ',
      '🕑 ',
      '🕐 ',
    ],
  },
  aesthetic: {
    interval: 80,
    frames: [
      '▰▱▱▱▱▱▱',
      '▰▰▱▱▱▱▱',
      '▰▰▰▱▱▱▱',
      '▰▰▰▰▱▱▱',
      '▰▰▰▰▰▱▱',
      '▰▰▰▰▰▰▱',
      '▰▰▰▰▰▰▰',
      '▰▱▱▱▱▱▱',
    ],
  },
  dwarfFortress: {
    interval: 80,
    frames: [
      ' ██████£££  ',
      '☺██████£££  ',
      '☺██████£££  ',
      '☺▓█████£££  ',
      '☺▓█████£££  ',
      '☺▒█████£££  ',
      '☺▒█████£££  ',
      '☺░█████£££  ',
      '☺░█████£££  ',
      '☺ █████£££  ',
      ' ☺█████£££  ',
      ' ☺█████£££  ',
      ' ☺▓████£££  ',
      ' ☺▓████£££  ',
      ' ☺▒████£££  ',
      ' ☺▒████£££  ',
      ' ☺░████£££  ',
      ' ☺░████£££  ',
      ' ☺ ████£££  ',
      '  ☺████£££  ',
      '  ☺████£££  ',
      '  ☺▓███£££  ',
      '  ☺▓███£££  ',
      '  ☺▒███£££  ',
      '  ☺▒███£££  ',
      '  ☺░███£££  ',
      '  ☺░███£££  ',
      '  ☺ ███£££  ',
      '   ☺███£££  ',
      '   ☺███£££  ',
      '   ☺▓██£££  ',
      '   ☺▓██£££  ',
      '   ☺▒██£££  ',
      '   ☺▒██£££  ',
      '   ☺░██£££  ',
      '   ☺░██£££  ',
      '   ☺ ██£££  ',
      '    ☺██£££  ',
      '    ☺██£££  ',
      '    ☺▓█£££  ',
      '    ☺▓█£££  ',
      '    ☺▒█£££  ',
      '    ☺▒█£££  ',
      '    ☺░█£££  ',
      '    ☺░█£££  ',
      '    ☺ █£££  ',
      '     ☺█£££  ',
      '     ☺█£££  ',
      '     ☺▓£££  ',
      '     ☺▓£££  ',
      '     ☺▒£££  ',
      '     ☺▒£££  ',
      '     ☺░£££  ',
      '     ☺░£££  ',
      '     ☺ £££  ',
      '      ☺£££  ',
      '      ☺£££  ',
      '      ☺▓££  ',
      '      ☺▓££  ',
      '      ☺▒££  ',
      '      ☺▒££  ',
      '      ☺░££  ',
      '      ☺░££  ',
      '      ☺ ££  ',
      '       ☺££  ',
      '       ☺££  ',
      '       ☺▓£  ',
      '       ☺▓£  ',
      '       ☺▒£  ',
      '       ☺▒£  ',
      '       ☺░£  ',
      '       ☺░£  ',
      '       ☺ £  ',
      '        ☺£  ',
      '        ☺£  ',
      '        ☺▓  ',
      '        ☺▓  ',
      '        ☺▒  ',
      '        ☺▒  ',
      '        ☺░  ',
      '        ☺░  ',
      '        ☺   ',
      '        ☺  &',
      '        ☺ ☼&',
      '       ☺ ☼ &',
      '       ☺☼  &',
      '      ☺☼  & ',
      '      ‼   & ',
      '     ☺   &  ',
      '    ‼    &  ',
      '   ☺    &   ',
      '  ‼     &   ',
      ' ☺     &    ',
      '‼      &    ',
      '      &     ',
      '      &     ',
      '     &   ░  ',
      '     &   ▒  ',
      '    &    ▓  ',
      '    &    £  ',
      '   &    ░£  ',
      '   &    ▒£  ',
      '  &     ▓£  ',
      '  &     ££  ',
      ' &     ░££  ',
      ' &     ▒££  ',
      '&      ▓££  ',
      '&      £££  ',
      '      ░£££  ',
      '      ▒£££  ',
      '      ▓£££  ',
      '      █£££  ',
      '     ░█£££  ',
      '     ▒█£££  ',
      '     ▓█£££  ',
      '     ██£££  ',
      '    ░██£££  ',
      '    ▒██£££  ',
      '    ▓██£££  ',
      '    ███£££  ',
      '   ░███£££  ',
      '   ▒███£££  ',
      '   ▓███£££  ',
      '   ████£££  ',
      '  ░████£££  ',
      '  ▒████£££  ',
      '  ▓████£££  ',
      '  █████£££  ',
      ' ░█████£££  ',
      ' ▒█████£££  ',
      ' ▓█████£££  ',
      ' ██████£££  ',
      ' ██████£££  ',
    ],
  },
}

class Ora {
  #linesToClear = 0
  #isDiscardingStdin = false
  #lineCount = 0
  #frameIndex = 0
  #options
  #spinner
  #stream
  #id
  #initialInterval
  #isEnabled
  #isSilent
  #indent
  #text
  #prefixText
  #suffixText

  color

  constructor(options) {
    if (typeof options === 'string') {
      options = {
        text: options,
      }
    }

    this.#options = {
      color: 'cyan',
      stream: process.stderr,
      discardStdin: true,
      hideCursor: true,
      ...options,
    }

    // Public
    this.color = this.#options.color

    // It's important that these use the public setters.
    this.spinner = this.#options.spinner

    this.#initialInterval = this.#options.interval
    this.#stream = this.#options.stream
    this.#isEnabled =
      typeof this.#options.isEnabled === 'boolean'
        ? this.#options.isEnabled
        : isInteractive({ stream: this.#stream })
    this.#isSilent =
      typeof this.#options.isSilent === 'boolean'
        ? this.#options.isSilent
        : false

    // Set *after* `this.#stream`.
    // It's important that these use the public setters.
    this.text = this.#options.text
    this.prefixText = this.#options.prefixText
    this.suffixText = this.#options.suffixText
    this.indent = this.#options.indent

    if (process.env.NODE_ENV === 'test') {
      this._stream = this.#stream
      this._isEnabled = this.#isEnabled

      Object.defineProperty(this, '_linesToClear', {
        get() {
          return this.#linesToClear
        },
        set(newValue) {
          this.#linesToClear = newValue
        },
      })

      Object.defineProperty(this, '_frameIndex', {
        get() {
          return this.#frameIndex
        },
      })

      Object.defineProperty(this, '_lineCount', {
        get() {
          return this.#lineCount
        },
      })
    }
  }

  get indent() {
    return this.#indent
  }

  set indent(indent = 0) {
    if (!(indent >= 0 && Number.isInteger(indent))) {
      throw new Error('The `indent` option must be an integer from 0 and up')
    }

    this.#indent = indent
    this.#updateLineCount()
  }

  get interval() {
    return this.#initialInterval ?? this.#spinner.interval ?? 100
  }

  get spinner() {
    return this.#spinner
  }

  set spinner(spinner) {
    this.#frameIndex = 0
    this.#initialInterval = undefined

    if (typeof spinner === 'object') {
      if (spinner.frames === undefined) {
        throw new Error('The given spinner must have a `frames` property')
      }

      this.#spinner = spinner
    } else if (!isUnicodeSupported()) {
      this.#spinner = cliSpinners.line
    } else if (spinner === undefined) {
      // Set default spinner
      this.#spinner = cliSpinners.dots
    } else if (spinner !== 'default' && cliSpinners[spinner]) {
      this.#spinner = cliSpinners[spinner]
    } else {
      throw new Error(
        `There is no built-in spinner named '${spinner}'. See https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json for a full list.`
      )
    }
  }

  get text() {
    return this.#text
  }

  set text(value = '') {
    this.#text = value
    this.#updateLineCount()
  }

  get prefixText() {
    return this.#prefixText
  }

  set prefixText(value = '') {
    this.#prefixText = value
    this.#updateLineCount()
  }

  get suffixText() {
    return this.#suffixText
  }

  set suffixText(value = '') {
    this.#suffixText = value
    this.#updateLineCount()
  }

  get isSpinning() {
    return this.#id !== undefined
  }

  #getFullPrefixText(prefixText = this.#prefixText, postfix = ' ') {
    if (typeof prefixText === 'string' && prefixText !== '') {
      return prefixText + postfix
    }

    if (typeof prefixText === 'function') {
      return prefixText() + postfix
    }

    return ''
  }

  #getFullSuffixText(suffixText = this.#suffixText, prefix = ' ') {
    if (typeof suffixText === 'string' && suffixText !== '') {
      return prefix + suffixText
    }

    if (typeof suffixText === 'function') {
      return prefix + suffixText()
    }

    return ''
  }

  #updateLineCount() {
    const columns = this.#stream.columns ?? 80
    const fullPrefixText = this.#getFullPrefixText(this.#prefixText, '-')
    const fullSuffixText = this.#getFullSuffixText(this.#suffixText, '-')
    const fullText =
      ' '.repeat(this.#indent) +
      fullPrefixText +
      '--' +
      this.#text +
      '--' +
      fullSuffixText

    this.#lineCount = 0
    for (const line of stripAnsi(fullText).split('\n')) {
      this.#lineCount += Math.max(
        1,
        Math.ceil(stringWidth(line, { countAnsiEscapeCodes: true }) / columns)
      )
    }
  }

  get isEnabled() {
    return this.#isEnabled && !this.#isSilent
  }

  set isEnabled(value) {
    if (typeof value !== 'boolean') {
      throw new TypeError('The `isEnabled` option must be a boolean')
    }

    this.#isEnabled = value
  }

  get isSilent() {
    return this.#isSilent
  }

  set isSilent(value) {
    if (typeof value !== 'boolean') {
      throw new TypeError('The `isSilent` option must be a boolean')
    }

    this.#isSilent = value
  }

  frame() {
    const { frames } = this.#spinner
    let frame = frames[this.#frameIndex]

    if (this.color) {
      frame = acurastColor(frame)
    }

    this.#frameIndex = ++this.#frameIndex % frames.length
    const fullPrefixText =
      typeof this.#prefixText === 'string' && this.#prefixText !== ''
        ? this.#prefixText + ' '
        : ''
    const fullText = typeof this.text === 'string' ? ' ' + this.text : ''
    const fullSuffixText =
      typeof this.#suffixText === 'string' && this.#suffixText !== ''
        ? ' ' + this.#suffixText
        : ''

    return fullPrefixText + frame + fullText + fullSuffixText
  }

  clear() {
    if (!this.#isEnabled || !this.#stream.isTTY) {
      return this
    }

    this.#stream.cursorTo(0)

    for (let index = 0; index < this.#linesToClear; index++) {
      if (index > 0) {
        this.#stream.moveCursor(0, -1)
      }

      this.#stream.clearLine(1)
    }

    if (this.#indent || this.lastIndent !== this.#indent) {
      this.#stream.cursorTo(this.#indent)
    }

    this.lastIndent = this.#indent
    this.#linesToClear = 0

    return this
  }

  render() {
    if (this.#isSilent) {
      return this
    }

    this.clear()
    this.#stream.write(this.frame())
    this.#linesToClear = this.#lineCount

    return this
  }

  start(text) {
    if (text) {
      this.text = text
    }

    if (this.#isSilent) {
      return this
    }

    if (!this.#isEnabled) {
      if (this.text) {
        this.#stream.write(`- ${this.text}\n`)
      }

      return this
    }

    if (this.isSpinning) {
      return this
    }

    if (this.#options.hideCursor) {
      cliCursor.hide(this.#stream)
    }

    if (this.#options.discardStdin && process.stdin.isTTY) {
      this.#isDiscardingStdin = true
      stdinDiscarder.start()
    }

    this.render()
    this.#id = setInterval(this.render.bind(this), this.interval)

    return this
  }

  stop() {
    if (!this.#isEnabled) {
      return this
    }

    clearInterval(this.#id)
    this.#id = undefined
    this.#frameIndex = 0
    this.clear()
    if (this.#options.hideCursor) {
      cliCursor.show(this.#stream)
    }

    if (
      this.#options.discardStdin &&
      process.stdin.isTTY &&
      this.#isDiscardingStdin
    ) {
      stdinDiscarder.stop()
      this.#isDiscardingStdin = false
    }

    return this
  }

  succeed(text) {
    return this.stopAndPersist({ symbol: logSymbols.success, text })
  }

  fail(text) {
    return this.stopAndPersist({ symbol: logSymbols.error, text })
  }

  warn(text) {
    return this.stopAndPersist({ symbol: logSymbols.warning, text })
  }

  info(text) {
    return this.stopAndPersist({ symbol: logSymbols.info, text })
  }

  stopAndPersist(options = {}) {
    if (this.#isSilent) {
      return this
    }

    const prefixText = options.prefixText ?? this.#prefixText
    const fullPrefixText = this.#getFullPrefixText(prefixText, ' ')

    const symbolText = options.symbol ?? ' '

    const text = options.text ?? this.text
    const fullText = typeof text === 'string' ? ' ' + text : ''

    const suffixText = options.suffixText ?? this.#suffixText
    const fullSuffixText = this.#getFullSuffixText(suffixText, ' ')

    const textToWrite =
      fullPrefixText + symbolText + fullText + fullSuffixText + '\n'

    this.stop()
    this.#stream.write(textToWrite)

    return this
  }
}

export default function ora(options) {
  return new Ora(options)
}

export async function oraPromise(action, options) {
  const actionIsFunction = typeof action === 'function'
  const actionIsPromise = typeof action.then === 'function'

  if (!actionIsFunction && !actionIsPromise) {
    throw new TypeError('Parameter `action` must be a Function or a Promise')
  }

  const { successText, failText } =
    typeof options === 'object'
      ? options
      : { successText: undefined, failText: undefined }

  const spinner = ora(options).start()

  try {
    const promise = actionIsFunction ? action(spinner) : action
    const result = await promise

    spinner.succeed(
      successText === undefined
        ? undefined
        : typeof successText === 'string'
          ? successText
          : successText(result)
    )

    return result
  } catch (error) {
    spinner.fail(
      failText === undefined
        ? undefined
        : typeof failText === 'string'
          ? failText
          : failText(error)
    )

    throw error
  }
}
