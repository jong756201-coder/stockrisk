'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FMPService } from '@/lib/api/fmp';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data: role } = await supabase
    .from('user_roles')
    .select('role_type')
    .eq('user_id', user.id)
    .single();

  if (role?.role_type !== 'admin') throw new Error('관리자 권한이 필요합니다.');
  return { supabase, user };
}

export async function addThemeTicker(
  themeId: string,
  symbol: string
): Promise<{ success: boolean; error?: string; name?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    const upperSymbol = symbol.trim().toUpperCase();
    if (!upperSymbol) return { success: false, error: '심볼을 입력하세요.' };

    // FMP로 유효한 종목인지 검증
    const quotes = await FMPService.getRealTimeQuotes([upperSymbol]);
    if (!quotes[upperSymbol]) {
      return { success: false, error: `"${upperSymbol}" 종목을 찾을 수 없습니다.` };
    }

    const { error } = await supabase.from('theme_tickers').upsert({
      theme_id: themeId,
      symbol: upperSymbol,
      added_by: user.id,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath(`/themes/${themeId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function removeThemeTicker(
  themeId: string,
  symbol: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const { error } = await supabase
      .from('theme_tickers')
      .delete()
      .eq('theme_id', themeId)
      .eq('symbol', symbol.toUpperCase());

    if (error) return { success: false, error: error.message };

    revalidatePath(`/themes/${themeId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
