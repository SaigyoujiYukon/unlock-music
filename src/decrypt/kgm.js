import {
    AudioMimeType,
    BytesHasPrefix,
    GetArrayBuffer,
    GetCoverFromFile,
    GetMetaFromFile,
    SniffAudioExt
} from "@/decrypt/utils.ts";
import {parseBlob as metaParseBlob} from "music-metadata-browser";

const VprHeader = [
    0x05, 0x28, 0xBC, 0x96, 0xE9, 0xE4, 0x5A, 0x43,
    0x91, 0xAA, 0xBD, 0xD0, 0x7A, 0xF5, 0x36, 0x31]
const KgmHeader = [
    0x7C, 0xD5, 0x32, 0xEB, 0x86, 0x02, 0x7F, 0x4B,
    0xA8, 0xAF, 0xA6, 0x8E, 0x0F, 0xFF, 0x99, 0x14]
const VprMaskDiff = [0x25, 0xDF, 0xE8, 0xA6, 0x75, 0x1E, 0x75, 0x0E,
    0x2F, 0x80, 0xF3, 0x2D, 0xB8, 0xB6, 0xE3, 0x11,
    0x00]

export async function Decrypt(file, raw_filename, raw_ext) {
    try {
        if (window.location.protocol === "file:") {
            return {
                status: false,
                message: "请使用<a target='_blank' href='https://github.com/ix64/unlock-music/wiki/其他音乐格式工具'>CLI版本</a>进行解锁"
            }
        }
    } catch {
    }
    const oriData = new Uint8Array(await GetArrayBuffer(file));
    if (raw_ext === "vpr") {
        if (!BytesHasPrefix(oriData, VprHeader))
            return {status: false, message: "Not a valid vpr file!"}
    } else {
        if (!BytesHasPrefix(oriData, KgmHeader))
            return {status: false, message: "Not a valid kgm/kgma file!"}
    }
    let bHeaderLen = new DataView(oriData.slice(0x10, 0x14).buffer)
    let headerLen = bHeaderLen.getUint32(0, true)

    let audioData = oriData.slice(headerLen)
    let dataLen = audioData.length
    if (audioData.byteLength > 1 << 26) {
        return {
            status: false,
            message: "文件过大，请使用<a target='_blank' href='https://github.com/ix64/unlock-music/wiki/其他音乐格式工具'>CLI版本</a>进行解锁"
        }
    }

    let key1 = new Uint8Array(17)
    key1.set(oriData.slice(0x1c, 0x2c), 0)
    if (MaskV2 == null) {
        if (!await LoadMaskV2()) {
            return {status: false, message: "加载Kgm/Vpr Mask数据失败"}
        }
    }

    for (let i = 0; i < dataLen; i++) {
        let med8 = key1[i % 17] ^ audioData[i]
        med8 ^= (med8 & 0xf) << 4

        let msk8 = GetMask(i)
        msk8 ^= (msk8 & 0xf) << 4
        audioData[i] = med8 ^ msk8
    }
    if (raw_ext === "vpr") {
        for (let i = 0; i < dataLen; i++) audioData[i] ^= VprMaskDiff[i % 17]
    }

    const ext = SniffAudioExt(audioData);
    const mime = AudioMimeType[ext];
    let musicBlob = new Blob([audioData], {type: mime});
    const musicMeta = await metaParseBlob(musicBlob);
    const {title, artist} = GetMetaFromFile(raw_filename, musicMeta.common.title, musicMeta.common.artist)
    return {
        status: true,
        album: musicMeta.common.album,
        picture: GetCoverFromFile(musicMeta),
        file: URL.createObjectURL(musicBlob),
        ext,
        mime,
        title,
        artist
    }
}

function GetMask(pos) {
    return MaskV2PreDef[pos % 272] ^ MaskV2[pos >> 4]
}

let MaskV2 = null;

async function LoadMaskV2() {
    try {
        let resp = await fetch("./static/kgm.mask", {
            method: "GET"
        })
        MaskV2 = new Uint8Array(await resp.arrayBuffer());
        return true
    } catch (e) {
        console.error(e)
        return false
    }
}

const MaskV2PreDef = [
    0xB8, 0xD5, 0x3D, 0xB2, 0xE9, 0xAF, 0x78, 0x8C, 0x83, 0x33, 0x71, 0x51, 0x76, 0xA0, 0xCD, 0x37,
    0x2F, 0x3E, 0x35, 0x8D, 0xA9, 0xBE, 0x98, 0xB7, 0xE7, 0x8C, 0x22, 0xCE, 0x5A, 0x61, 0xDF, 0x68,
    0x69, 0x89, 0xFE, 0xA5, 0xB6, 0xDE, 0xA9, 0x77, 0xFC, 0xC8, 0xBD, 0xBD, 0xE5, 0x6D, 0x3E, 0x5A,
    0x36, 0xEF, 0x69, 0x4E, 0xBE, 0xE1, 0xE9, 0x66, 0x1C, 0xF3, 0xD9, 0x02, 0xB6, 0xF2, 0x12, 0x9B,
    0x44, 0xD0, 0x6F, 0xB9, 0x35, 0x89, 0xB6, 0x46, 0x6D, 0x73, 0x82, 0x06, 0x69, 0xC1, 0xED, 0xD7,
    0x85, 0xC2, 0x30, 0xDF, 0xA2, 0x62, 0xBE, 0x79, 0x2D, 0x62, 0x62, 0x3D, 0x0D, 0x7E, 0xBE, 0x48,
    0x89, 0x23, 0x02, 0xA0, 0xE4, 0xD5, 0x75, 0x51, 0x32, 0x02, 0x53, 0xFD, 0x16, 0x3A, 0x21, 0x3B,
    0x16, 0x0F, 0xC3, 0xB2, 0xBB, 0xB3, 0xE2, 0xBA, 0x3A, 0x3D, 0x13, 0xEC, 0xF6, 0x01, 0x45, 0x84,
    0xA5, 0x70, 0x0F, 0x93, 0x49, 0x0C, 0x64, 0xCD, 0x31, 0xD5, 0xCC, 0x4C, 0x07, 0x01, 0x9E, 0x00,
    0x1A, 0x23, 0x90, 0xBF, 0x88, 0x1E, 0x3B, 0xAB, 0xA6, 0x3E, 0xC4, 0x73, 0x47, 0x10, 0x7E, 0x3B,
    0x5E, 0xBC, 0xE3, 0x00, 0x84, 0xFF, 0x09, 0xD4, 0xE0, 0x89, 0x0F, 0x5B, 0x58, 0x70, 0x4F, 0xFB,
    0x65, 0xD8, 0x5C, 0x53, 0x1B, 0xD3, 0xC8, 0xC6, 0xBF, 0xEF, 0x98, 0xB0, 0x50, 0x4F, 0x0F, 0xEA,
    0xE5, 0x83, 0x58, 0x8C, 0x28, 0x2C, 0x84, 0x67, 0xCD, 0xD0, 0x9E, 0x47, 0xDB, 0x27, 0x50, 0xCA,
    0xF4, 0x63, 0x63, 0xE8, 0x97, 0x7F, 0x1B, 0x4B, 0x0C, 0xC2, 0xC1, 0x21, 0x4C, 0xCC, 0x58, 0xF5,
    0x94, 0x52, 0xA3, 0xF3, 0xD3, 0xE0, 0x68, 0xF4, 0x00, 0x23, 0xF3, 0x5E, 0x0A, 0x7B, 0x93, 0xDD,
    0xAB, 0x12, 0xB2, 0x13, 0xE8, 0x84, 0xD7, 0xA7, 0x9F, 0x0F, 0x32, 0x4C, 0x55, 0x1D, 0x04, 0x36,
    0x52, 0xDC, 0x03, 0xF3, 0xF9, 0x4E, 0x42, 0xE9, 0x3D, 0x61, 0xEF, 0x7C, 0xB6, 0xB3, 0x93, 0x50,
]

