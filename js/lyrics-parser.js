/* ============================================
   LyricForge — LRC / SRT / ASS Parser
   ============================================ */

class LyricsParser {
    static parseLRC(content) {
        const lines = content.split('\n');
        const lyrics = [];
        const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                let ms = parseInt(match[3]);
                if (match[3].length === 2) ms *= 10;
                const time = mins * 60 + secs + ms / 1000;
                const text = match[4].trim();
                if (text) {
                    lyrics.push({ time, text, index: lyrics.length });
                }
            }
        }

        lyrics.sort((a, b) => a.time - b.time);
        return lyrics;
    }

    static parseSRT(content) {
        const blocks = content.trim().split(/\n\n+/);
        const lyrics = [];

        for (const block of blocks) {
            const lines = block.split('\n');
            if (lines.length < 3) continue;
            const timeLine = lines[1];
            const text = lines.slice(2).join(' ').trim();
            const timeMatch = timeLine.match(
                /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
            );
            if (timeMatch && text) {
                const start =
                    parseInt(timeMatch[1]) * 3600 +
                    parseInt(timeMatch[2]) * 60 +
                    parseInt(timeMatch[3]) +
                    parseInt(timeMatch[4]) / 1000;
                lyrics.push({ time: start, text, index: lyrics.length });
            }
        }

        lyrics.sort((a, b) => a.time - b.time);
        return lyrics;
    }

    static parseASS(content) {
        const lyrics = [];
        const lines = content.split('\n');

        for (const line of lines) {
            if (!line.startsWith('Dialogue:')) continue;
            const parts = line.split(',');
            if (parts.length < 10) continue;
            const startStr = parts[1].trim();
            const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').trim();
            if (!text) continue;

            const timeParts = startStr.split(':');
            if (timeParts.length < 3) continue;
            const start =
                parseFloat(timeParts[0]) * 3600 +
                parseFloat(timeParts[1]) * 60 +
                parseFloat(timeParts[2]);

            lyrics.push({ time: start, text, index: lyrics.length });
        }

        lyrics.sort((a, b) => a.time - b.time);
        return lyrics;
    }

    static detectFormat(content) {
        if (content.trim().startsWith('[')) return 'lrc';
        if (content.includes('-->')) return 'srt';
        if (content.includes('Dialogue:')) return 'ass';
        if (content.includes('Format:') || content.includes('Style:')) return 'ass';
        return null;
    }

    static parse(content) {
        const format = LyricsParser.detectFormat(content);
        if (!format) return null;

        switch (format) {
            case 'lrc': return LyricsParser.parseLRC(content);
            case 'srt': return LyricsParser.parseSRT(content);
            case 'ass': return LyricsParser.parseASS(content);
            default: return null;
        }
    }

    static formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    static generateLRC(lyrics) {
        return lyrics
            .map(l => `[${LyricsParser.formatTime(l.time)}]${l.text}`)
            .join('\n');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LyricsParser;
}
