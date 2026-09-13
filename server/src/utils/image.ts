import { Decoder, Demuxer, Scaler } from 'node-av/api';

export async function squarePng(input: string | Buffer, size: number): Promise<Buffer | null> {
  await using demuxer = await Demuxer.open(input);
  const stream = demuxer.video();
  if (!stream) return null;

  using decoder = await Decoder.create(stream, { exitOnError: false });
  using scaler = new Scaler();

  for await (using frame of decoder.frames(demuxer.packets(stream.index))) {
    if (!frame) continue;

    const side = Math.min(frame.width, frame.height) & ~1;
    if (side < 2) return null;

    const crop = { x: ((frame.width - side) / 2) & ~1, y: ((frame.height - side) / 2) & ~1, width: side, height: side };
    return await scaler.toPng(frame, { crop, resize: { width: size, height: size }, format: 'rgba' });
  }

  return null;
}
