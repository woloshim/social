// Единая логика вычисления итогового URL аватара пользователя: либо загруженный
// вручную (avatar_source = 'custom'), либо аватар из Telegram-профиля (photo_url).
// Используется во всех местах, где сериализуется автор (посты, комментарии, истории,
// профиль, админка), чтобы фронтенду не нужно было дублировать эту логику.
export function avatarUrl(u: { avatar_source?: string | null; custom_avatar_path?: string | null; photo_url?: string | null }): string | null {
  if (u.avatar_source === "custom" && u.custom_avatar_path) {
    return `/uploads/${u.custom_avatar_path}`;
  }
  return u.photo_url || null;
}
