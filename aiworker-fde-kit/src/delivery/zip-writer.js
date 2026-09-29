import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { inflateRawSync } from "node:zlib";

import { ZipFile } from "yazl";

import { sha256Bytes, sortRelativePaths } from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";

const ZIP_EPOCH = new Date("1980-01-01T00:00:00.000Z");
const ZIP_EPOCH_LOCAL = new Date(1980, 0, 1, 0, 0, 0, 0);

function fileMode(relativePath) {
  return relativePath === "assembly/octopus-cli-assemble.sh"
    ? 0o100755
    : 0o100644;
}

export async function writeDeterministicZip(target, files, options = {}) {
  const requestedMtime = options.mtime ?? ZIP_EPOCH;
  if (
    !(requestedMtime instanceof Date) ||
    Number.isNaN(requestedMtime.getTime()) ||
    requestedMtime.getUTCFullYear() < 1980
  ) {
    throw new Error("ZIP timestamp must be a valid ZIP-epoch-or-later Date.");
  }
  const zip = new ZipFile();
  for (const relativePath of sortRelativePaths([...files.keys()])) {
    zip.addBuffer(files.get(relativePath), relativePath, {
      mtime: ZIP_EPOCH_LOCAL,
      mode: fileMode(relativePath),
      compress: true,
      compressionLevel: 9,
      forceDosTimestamp: true,
      forceZip64Format: false,
    });
  }
  zip.end({ forceZip64Format: false });
  const output = createWriteStream(target, {
    flags: "wx",
    mode: 0o600,
  });
  await pipeline(zip.outputStream, output);
}

function dosDate(date, time) {
  const year = 1980 + ((date >>> 9) & 0x7f);
  const month = (date >>> 5) & 0x0f;
  const day = date & 0x1f;
  const hour = (time >>> 11) & 0x1f;
  const minute = (time >>> 5) & 0x3f;
  const second = (time & 0x1f) * 2;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record is missing.");
}

export async function readZipEntries(target) {
  const archive = await readFile(target);
  const end = findEndOfCentralDirectory(archive);
  const disk = archive.readUInt16LE(end + 4);
  const centralDisk = archive.readUInt16LE(end + 6);
  const count = archive.readUInt16LE(end + 10);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralOffset = archive.readUInt32LE(end + 16);
  const commentLength = archive.readUInt16LE(end + 20);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    archive.readUInt16LE(end + 8) !== count ||
    end + 22 + commentLength !== archive.length ||
    centralOffset + centralSize !== end
  ) {
    throw new Error("ZIP central directory uses unsupported or inconsistent metadata.");
  }
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("ZIP central-directory entry is malformed.");
    }
    const versionMadeBy = archive.readUInt16LE(cursor + 4);
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const time = archive.readUInt16LE(cursor + 12);
    const date = archive.readUInt16LE(cursor + 14);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const fileCommentLength = archive.readUInt16LE(cursor + 32);
    const diskStart = archive.readUInt16LE(cursor + 34);
    const internalAttributes = archive.readUInt16LE(cursor + 36);
    const externalAttributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    const relativePath = nameBytes.toString("utf8");
    if (
      (versionMadeBy >>> 8) !== 3 ||
      flags !== 0x800 ||
      diskStart !== 0 ||
      internalAttributes !== 0 ||
      extraLength !== 0 ||
      fileCommentLength !== 0 ||
      relativePath.endsWith("/") ||
      archive.readUInt32LE(localOffset) !== 0x04034b50
    ) {
      throw new Error("ZIP entry contains forbidden metadata or a directory.");
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localName = archive.subarray(
      localOffset + 30,
      localOffset + 30 + localNameLength,
    ).toString("utf8");
    if (localName !== relativePath || localExtraLength !== 0) {
      throw new Error("ZIP local entry contains inconsistent metadata.");
    }
    const dataOffset = localOffset + 30 + localNameLength;
    const compressed = archive.subarray(
      dataOffset,
      dataOffset + compressedSize,
    );
    const bytes = method === 8
      ? inflateRawSync(compressed)
      : method === 0
        ? Buffer.from(compressed)
        : null;
    if (!bytes || bytes.length !== uncompressedSize) {
      throw new Error("ZIP entry compression is unsupported or inconsistent.");
    }
    entries.push({
      path: relativePath,
      bytes,
      sha256: sha256Bytes(bytes),
      mode: ((externalAttributes >>> 16) & 0o7777)
        .toString(8).padStart(4, "0"),
      mtime: dosDate(date, time).toISOString(),
      compression_method: method,
    });
    cursor += 46 + nameLength + extraLength + fileCommentLength;
  }
  if (cursor !== end) throw new Error("ZIP central directory length is inconsistent.");
  return entries;
}

export async function readAndVerifyZip(target, expectedFiles) {
  const issues = [];
  let entries;
  try {
    entries = await readZipEntries(target);
  } catch (error) {
    return {
      ...commandResult([issue(
        "BLOCKER",
        "B_ZIP_STRUCTURE",
        target,
        "ZIP structure or metadata is invalid.",
        { error: error instanceof Error ? error.message : String(error) },
      )]),
      entries: [],
    };
  }
  const expectedPaths = sortRelativePaths([...expectedFiles.keys()]);
  for (const [index, entry] of entries.entries()) {
    const expectedPath = expectedPaths[index];
    const expected = expectedFiles.get(entry.path);
    const expectedMode = entry.path === "assembly/octopus-cli-assemble.sh"
      ? "0755"
      : "0644";
    if (
      entry.path !== expectedPath ||
      !expected ||
      !entry.bytes.equals(expected) ||
      entry.mode !== expectedMode ||
      entry.mtime !== ZIP_EPOCH.toISOString() ||
      entry.compression_method !== 8
    ) {
      issues.push(issue(
        "BLOCKER",
        "B_ZIP_ENTRY",
        entry.path,
        "ZIP entry differs from the deterministic delivery contract.",
      ));
    }
  }
  if (entries.length !== expectedPaths.length) {
    issues.push(issue(
      "BLOCKER",
      "B_ZIP_COVERAGE",
      target,
      "ZIP does not exactly contain the expected files.",
    ));
  }
  return { ...commandResult(issues), entries };
}
