function toUserJson(row, options = {}) {
  if (!row) return null;
  const self = Boolean(options.self);
  const base = {
    id: row.id,
    email: row.email,
    name: row.name,
    age: row.age,
    profession: row.profession,
    company: row.company,
    city: row.city,
    bio: row.bio,
    photo_url: (() => {
      if (row.photo_url) return row.photo_url;
      try { return row.photo_urls ? JSON.parse(row.photo_urls)[0] || null : null; } catch (_) { return null; }
    })(),
    imageUrl: (() => {
      if (row.photo_url) return row.photo_url;
      try { return row.photo_urls ? JSON.parse(row.photo_urls)[0] || null : null; } catch (_) { return null; }
    })(),
    photo: (() => {
      if (row.photo_url) return row.photo_url;
      try { return row.photo_urls ? JSON.parse(row.photo_urls)[0] || null : null; } catch (_) { return null; }
    })(),
    photo_urls: (() => {
      try { return row.photo_urls ? JSON.parse(row.photo_urls) : (row.photo_url ? [row.photo_url] : []); } catch (_) { return row.photo_url ? [row.photo_url] : []; }
    })(),
    interests: row.interests ? JSON.parse(row.interests) : [],
    education: row.education,
    linkedin_url: row.linkedin_url,
    linkedin_verified: Boolean(row.linkedin_verified),
    is_premium: Boolean(row.is_premium),
    onboarding_complete: Boolean(row.onboarding_complete),
    gender: row.gender || null,
    interested_in: row.interested_in ? JSON.parse(row.interested_in) : [],
    industry: row.industry || null,
    job_level: row.job_level || null,
    experience_years: row.experience_years != null ? row.experience_years : null,
    latitude: row.latitude != null ? row.latitude : null,
    longitude: row.longitude != null ? row.longitude : null,
    about_you: (() => {
      if (!row.about_you_json) return null;
      try {
        const parsed = JSON.parse(row.about_you_json);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    })(),
    dating_prefs: (() => {
      if (!row.dating_prefs_json) return null;
      try {
        const parsed = JSON.parse(row.dating_prefs_json);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch (_) {
        return null;
      }
    })(),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (self) {
    base.expo_push_token = row.expo_push_token || null;
    base.expo_push_token_saved_at = row.expo_push_token_saved_at || null;
  }
  return base;
}

module.exports = { toUserJson };
