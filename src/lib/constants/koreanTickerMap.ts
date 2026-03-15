/**
 * 한글 포함 여부 감지
 */
export function containsKorean(text: string): boolean {
    return /[\uAC00-\uD7A3\u3131-\u314E\u3161-\u3163]/.test(text);
}
