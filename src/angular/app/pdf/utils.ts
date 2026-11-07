import type { PDFOperatorList } from "pdfjs-dist/types/src/display/api";
import type * as PdfJsLib from "pdfjs-dist";

function die(error: Error): never { throw error; }

let lib: typeof PdfJsLib | undefined;
export function setupPdfJs(l: typeof PdfJsLib) { lib = l; }
function pdfjs() { return lib ?? die(new Error("no pdfjs")); }

const DrawOPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4
} as const;

type XForm = Readonly<[number, number, number, number, number, number]>;
const compose = (m: XForm, n: XForm): XForm => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: XForm, c: Coord): Coord => ({
  x: m[0] * c.x + m[2] * c.y + m[4],
  y: m[1] * c.x + m[3] * c.y + m[5],
});

type Style = Readonly<{
  fillRGBColor: string,
  strokeRGBColor: string,
  lineWidth: number,
  lineCap: number,
  lineJoin: number,
  dash: [number[], number],
}>;

type State = Readonly<{ xform: XForm }> & Style;

export function* zip<T extends readonly Iterable<unknown>[]>(...iterables: T): Generator<{ [K in keyof T]: T[K] extends Iterable<infer U> ? U : never }> {
  const iterators = iterables.map(it => it[Symbol.iterator]());

  while (true) {
    const results = iterators.map(it => it.next());
    if (results.some(r => r.done)) return;
    yield results.map(r => r.value) as { [K in keyof T]: T[K] extends Iterable<infer U> ? U : never };
  }
}

export function* enumerate<T>(iterable: Iterable<T>): Generator<[number, T]> {
  let i = 0;
  for (const value of iterable) {
    yield [i++, value];
  }
}

function opName(fn: number) {
  const { OPS } = pdfjs();
  return Object.entries(OPS).find(([_, value]) => value === fn)?.[0] ?? "[unknown]";
}

type Fn = PDFOperatorList["fnArray"][0];
type FnArgs = PDFOperatorList["argsArray"][0];

export function* withState<T>(ops: Iterable<[Fn, FnArgs]>, inner: (fn: Fn, args: FnArgs, state: State) => Iterable<T>) {
  const { OPS } = pdfjs();

  let state: State = {
    xform: [1, 0, 0, 1, 0, 0],
    fillRGBColor: "#000000",
    strokeRGBColor: "#000000",
    lineWidth: 1,
    lineCap: 0,
    lineJoin: 0,
    dash: [[], 0],
  };

  const stack: State[] = []

  for (const [i, [fn, args]] of enumerate(ops)) {
    switch (fn) {
      case OPS.transform:
        state = { ...state, xform: compose(state.xform, args) };
        break;
      case OPS.save:
        stack.push(state);
        break;
      case OPS.restore:
        state = stack.pop() ?? die(new Error(`restore without save (@${i})`));
        break;
      case OPS.setFillRGBColor:
        state = { ...state, fillRGBColor: args[0] as string };
        break;
      case OPS.setStrokeRGBColor:
        state = { ...state, strokeRGBColor: args[0] as string };
        break;
      case OPS.setLineWidth:
        state = { ...state, lineWidth: args[0] as number };
        break;
      case OPS.setLineCap:
        state = { ...state, lineCap: args[0] as number };
        break;
      case OPS.setLineJoin:
        state = { ...state, lineJoin: args[0] as number };
        break;
      case OPS.setDash:
        state = { ...state, dash: args as [number[], number] };
        break;
      case OPS.setMiterLimit:
      case OPS.setRenderingIntent:
      case OPS.setFlatness:
      // case OPS.setGState:
      case OPS.setCharSpacing:
      case OPS.setWordSpacing:
      case OPS.setHScale:
      case OPS.setLeading:
      // case OPS.setFont:
      case OPS.setTextRenderingMode:
      case OPS.setTextRise:
      case OPS.setLeadingMoveText:
      // case OPS.setTextMatrix:
      case OPS.nextLineSetSpacingShowText:
      case OPS.setCharWidth:
      case OPS.setCharWidthAndBounds:
      case OPS.setStrokeColorSpace:
      case OPS.setFillColorSpace:
      case OPS.setStrokeColor:
      case OPS.setStrokeColorN:
      case OPS.setFillColor:
      case OPS.setFillColorN:
      case OPS.setStrokeGray:
      case OPS.setFillGray:
      case OPS.setStrokeCMYKColor:
      case OPS.setFillCMYKColor:
      case OPS.setStrokeTransparent:
      case OPS.setFillTransparent:
      case OPS.paintFormXObjectBegin:
      case OPS.paintFormXObjectEnd:
        die(new Error(`not implemented: ${opName(fn)} (${fn}): ${args}`));
        break;
      default:
        for (const val of inner(fn, args, state)) yield { i, ...val };
    }
  }
}

type Coord = Readonly<{ x: number, y: number }>;

type MoveSegment = Readonly<{ op: typeof DrawOPS["moveTo"] }> & Coord;
type LineSegment = Readonly<{ op: typeof DrawOPS["lineTo"] }> & Coord;
type CloseSegment = Readonly<{ op: typeof DrawOPS["closePath"] }>;
type Segment = MoveSegment | LineSegment | CloseSegment;
type Segments = Readonly<Segment[]>;

function* decodeSegments(xform: XForm, args: Float32Array): Generator<Segment> {
  let start: Coord | undefined = undefined;

  for (let i = 0; i < args.length;) {
    const op = args[i++];
    switch (op) {
      case DrawOPS.moveTo: {
        const x = args[i++]!;
        const y = args[i++]!;
        yield { op, ...(start = apply(xform, { x, y })) };
        break;
      }
      case DrawOPS.lineTo: {
        if (start === undefined) die(new Error("lineTo without moveTo"));
        const x = args[i++]!;
        const y = args[i++]!;
        yield { op, ...apply(xform, { x, y }) };
        break;
      }
      case DrawOPS.closePath:
        if (start === undefined) die(new Error("close without moveTo"));
        yield { op };
        break;
      default:
        die(new Error(`Unknown path command; dump ${args.slice(i - 1)}`));
    }
  }
}

type Path = Readonly<{
  drawOp: Fn,
  segments: Segments,
  style: Style,
}>;


export function* extractPaths(fn: Fn, args: FnArgs, state: State, ...filters: ((f: Iterable<Segment>) => Iterable<Segment>)[]): Generator<Path> {
  const { OPS } = pdfjs();

  switch (fn) {
    case OPS.constructPath: {
      const { xform, ...style } = state;
      const [drawOp, [opargs]] = args as [number, [Float32Array]];
      switch (drawOp) {
        case OPS.fill:
        case OPS.endPath:
          const initial: Iterable<Segment> = decodeSegments(xform, opargs);
          const segments = [...filters.reduce((prev, acc) => acc(prev), initial)];
          yield { drawOp, segments, style };
          break;
        default:
          die(new Error(`constructPath op not implemented: ${opName(drawOp)} (${drawOp})`));
      }
      break;
    }
  }
}

// type Identified<T> = { i: number } & T;

export function* closePaths(segments: Iterable<Segment>): Generator<Segment> {
  let start: Coord | undefined = undefined;

  for (const segment of segments)
    switch (segment.op) {
      case DrawOPS.moveTo: {
        const { x, y } = segment;
        start = { x, y };
        yield segment;
        break;
      }
      case DrawOPS.closePath: {
        if (start === undefined) die(new Error("close without moveTo"));
        yield { op: DrawOPS.lineTo, ...start };
        break;
      }
      default:
        yield segment;
    }
}

export function* coalesceCoord(segments: Iterable<Segment>): Generator<Segment> {
  let pos: Coord | undefined = undefined;

  for (const segment of segments)
    switch (segment.op) {
      case DrawOPS.moveTo: {
        const { x, y } = segment;
        pos = { x, y };
        yield segment;
        break;
      }
      case DrawOPS.lineTo: {
        if (pos === undefined) die(new Error("lineTo without moveTo"));
        const { x, y } = segment;
        if (pos.x !== x || pos.y === y) {
          pos = { x, y };
          yield segment;
        }
        break;
      }
      default:
        yield segment;
    }
}

function dot(u: Coord, v: Coord) { return u.x * v.x + u.y * v.y; }
// function cross(u: Coord, v: Coord) { return u.x * v.y - u.y * v.x; }
// function lengthsq(u: Coord) { return dot(u, u); }
function length({x, y}: Coord) { return Math.hypot(x, y); }

export function extractRectangles(elements: Iterable<{ i: number } & Path>) {
  const channels = [
    undefined as unknown as Pick<{ i: number } & Path, "i" | "drawOp" | "style">
      & { corners: [Coord, Coord, Coord, Coord], sides: Readonly<[Coord, Coord, Coord, Coord]>, lengths: [number, number, number, number], orientation: number },
    undefined as unknown as { i: number } & Path,
    undefined as unknown as { element: { i: number } & Path, nonDegenerate: boolean, orthogonal: boolean },
  ] as const;

  function* multiplexed(): Generator<MultiplexEvent<typeof channels>> {
    for (const element of elements) {
      const { i, drawOp, style, segments } = element;

      const at = segments.at(-2);
      const path00 = segments[0];

      const path0 = at?.op === DrawOPS.lineTo && path00?.op === DrawOPS.moveTo && at!.x === path00!.x && at!.y === path00!.y
        ? segments.slice(0, -2).concat(segments.at(-1)!)
        : segments;

      if (path0.length !== 5 ||
        path0[0]!.op !== DrawOPS.moveTo ||
        path0[1]!.op !== DrawOPS.lineTo ||
        path0[2]!.op !== DrawOPS.lineTo ||
        path0[3]!.op !== DrawOPS.lineTo ||
        path0[4]!.op !== DrawOPS.closePath) {
        yield { channel: 1, value: element };
      }

      const [a, b, c, d] = path0 as Readonly<Coord[]>;

      const sides = [
        { x: b!.x - a!.x, y: b!.y - a!.y },
        { x: c!.x - b!.x, y: c!.y - b!.y },
        { x: d!.x - c!.x, y: d!.y - c!.y },
        { x: a!.x - d!.x, y: a!.y - d!.y },
      ] as const;

      const [u, v, w, z] = sides;

      const lengths = sides.map(length) as [number, number, number, number];
      const coordinateScale = Math.max(...[a!, b!, c!, d!].flatMap(({x, y}) => [Math.abs(x), Math.abs(y)]));
      const eps = 1e-6;
      const minLength = coordinateScale * Number.EPSILON * 16;
      const nonDegenerate = lengths.every(l => l > minLength);
      const orthogonal = [
        [u, v] as const,
        [v, w] as const,
        [w, z] as const,
        [z, u] as const,
      ].every(([p, q]) => Math.abs(dot(p, q)) <= eps * length(p) * length(q));

      if (nonDegenerate || orthogonal) {
        yield { channel: 0, value: { i, drawOp, style, corners: [a!, b!, c!, d!], sides, lengths, orientation: Math.atan2(u.y, u.x) } };
      } else {
        yield { channel: 2, value: { element, nonDegenerate, orthogonal } };
      }
    }
  }

  return demultiplex(channels, multiplexed());
}



// type Event<K, V> = { channel: K; value: V };
//
// function multiplex<K extends PropertyKey, V>(producer: Generator<Event<K, V>>): Map<K, Generator<V>> {
//   const buffers = new Map<K, V[]>();
//   const done = new Set<K>();
//
//   function* consume(channel: K): Generator<V> {
//     const buffer = buffers.get(channel) ?? [];
//     buffers.set(channel, buffer);
//
//     while (true) {
//       while (buffer.length > 0) {
//         yield buffer.shift()!;
//       }
//
//       if (done.has(channel)) return;
//
//       const next = producer.next();
//       if (next.done) {
//         for (const key of buffers.keys()) done.add(key);
//         return;
//       }
//
//       const { channel: key, value } = next.value;
//       const target = buffers.get(key) ?? [];
//       target.push(value);
//       buffers.set(key, target);
//     }
//   }
//
//   return new Map(
//     [...buffers.keys()].map(key => [key, consume(key)])
//   );
// }

type MultiplexEvent<T extends object> =
  T extends readonly unknown[]
    ? {
      [K in Exclude<keyof T, keyof readonly unknown[]>]: {
        channel: K extends `${infer N extends number}` ? N : never;
        value: T[K];
      }
    }[Exclude<keyof T, keyof readonly unknown[]>]
    : {
      [K in keyof T]: {
        channel: K;
        value: T[K];
      }
    }[keyof T];

type Demultiplexed<T extends object> = {
  [K in keyof T]: Generator<T[K]>
};

function demultiplex<T extends object>(
  channels: T,
  source: Generator<MultiplexEvent<T>>,
): Demultiplexed<T> {
  const keys = Array.isArray(channels)
    ? Object.keys(channels).map(Number)
    : Reflect.ownKeys(channels);

  const buffers = new Map<PropertyKey, unknown[]>(
    keys.map(key => [key, []])
  );

  let done = false;

  function* consume<K extends keyof T>(channel: K): Generator<T[K]> {
    const buffer = buffers.get(channel)!;

    while (true) {
      while (buffer.length > 0) {
        yield buffer.shift() as T[K];
      }

      if (done) return;

      const next = source.next();

      if (next.done) {
        done = true;
        return;
      }

      const { channel: target, value } = next.value;
      const targetBuffer = buffers.get(target);

      if (targetBuffer === undefined)
        throw new Error(`Unknown channel: ${String(target)}`);

      targetBuffer.push(value);
    }
  }

  const result = Array.isArray(channels)
    ? keys.map(key => consume(Number(key) as keyof T))
    : Object.fromEntries(keys.map(key => [key, consume(key as keyof T)]));

  return result as Demultiplexed<T>;
}

// // --------------------------------------------------
// // USO COM OBJETO
// // --------------------------------------------------
//
// type Path = { points: number[] };
// type Text = { content: string };
// type Image = { src: string };
//
// const objectChannels = {
//   path: undefined as unknown as Path,
//   text: undefined as unknown as Text,
//   image: undefined as unknown as Image,
// };
//
// function* objectProducer(): Generator<MultiplexEvent<typeof objectChannels>> {
//   yield { channel: "path", value: { points: [1, 2] } };
//   yield { channel: "text", value: { content: "hello" } };
//   yield { channel: "image", value: { src: "image.png" } };
// }
//
// const { path, text, image } = demultiplex(
//   objectChannels,
//   objectProducer(),
// );
//
// // path: Generator<Path>
// // text: Generator<Text>
// // image: Generator<Image>
//
//
// // --------------------------------------------------
// // USO COM TUPLA
// // --------------------------------------------------
//
// const tupleChannels = [
//   undefined as unknown as Path,
//   undefined as unknown as Text,
//   undefined as unknown as Image,
// ] as const;
//
// function* tupleProducer(): Generator<MultiplexEvent<typeof tupleChannels>> {
//   yield { channel: 0, value: { points: [1, 2] } };
//   yield { channel: 1, value: { content: "hello" } };
//   yield { channel: 2, value: { src: "image.png" } };
// }
//
// const [path2, text2, image2] = demultiplex(
//   tupleChannels,
//   tupleProducer(),
// );
//
// // path2: Generator<Path>
// // text2: Generator<Text>
// // image2: Generator<Image>
