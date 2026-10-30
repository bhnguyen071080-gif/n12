-- The unique material identity index evaluates this immutable helper during
-- authenticated inserts and updates. Table RLS still controls the row write.
grant execute on function private.normalize_material_identity(text) to authenticated;

