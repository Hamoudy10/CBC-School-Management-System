-- Create user_profiles table for extended user profile data (photo, address, etc.)
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    photo_url TEXT DEFAULT NULL,
    date_of_birth TEXT DEFAULT NULL,
    address TEXT DEFAULT NULL,
    national_id TEXT DEFAULT NULL,
    emergency_contact_name TEXT DEFAULT NULL,
    emergency_contact_phone TEXT DEFAULT NULL,
    blood_group TEXT DEFAULT NULL,
    medical_conditions TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());
