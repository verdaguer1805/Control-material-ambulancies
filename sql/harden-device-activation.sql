-- Tighten activation only. Existing authorizations, codes and stock are preserved.
begin;
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.activate_device(text,text,text)'::regprocedure);
  if position('DEVICE_ACTIVATION_NULL_GUARD' in definition) > 0 then return; end if;
  if position('if not v_config.enforcement_enabled or v_config.activation_code_hash is null then' in definition) = 0
     or position('<> v_config.activation_code_hash' in definition) = 0 then
    raise exception 'Unexpected activation function: review before applying';
  end if;
  definition := replace(definition,
    'if not v_config.enforcement_enabled or v_config.activation_code_hash is null then',
    'if v_config.enforcement_enabled is distinct from true or nullif(v_config.activation_code_hash, '''') is null then');
  definition := replace(definition, '<> v_config.activation_code_hash', 'is distinct from v_config.activation_code_hash');
  definition := replace(definition,
    'if v_user_id is null then',
    '-- DEVICE_ACTIVATION_NULL_GUARD
  if p_activation_code is null or p_activation_code !~ ''^[0-9]{8,12}$'' then
    raise exception ''INVALID_DEVICE_ACTIVATION_CODE'';
  end if;
  if v_user_id is null then');
  if position('DEVICE_ACTIVATION_NULL_GUARD' in definition) = 0 then
    raise exception 'Missing guard insertion point';
  end if;
  execute definition;
end
$migration$;
commit;
