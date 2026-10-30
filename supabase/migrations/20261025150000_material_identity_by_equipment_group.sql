begin;

-- Consolidate confirmed duplicate catalogue rows. The retained code is the
-- lower/older catalogue code; any future references are moved before delete.
with mapping(duplicate_code,canonical_code) as (values
 ('VT-CC-003','VT-CC-002'),
 ('VT-KC-047','VT-KC-007'),
 ('VT-KC-060','VT-KC-034'),
 ('VT-QC-054','VT-QC-051'),
 ('VT-RTG-040','VT-RTG-039'),
 ('VT-RTG-055','VT-RTG-054'),
 ('VT-TK-028','VT-TK-013'),
 ('VT-TK-029','VT-TK-014')
), ids as (
 select duplicate.id duplicate_id,canonical.id canonical_id
 from mapping
 join public.materials duplicate on duplicate.code=mapping.duplicate_code
 join public.materials canonical on canonical.code=mapping.canonical_code and canonical.workspace_id=duplicate.workspace_id
)
update public.repair_material_usages usage set material_id=ids.canonical_id from ids where usage.material_id=ids.duplicate_id;

with mapping(duplicate_code,canonical_code) as (values
 ('VT-CC-003','VT-CC-002'),('VT-KC-047','VT-KC-007'),('VT-KC-060','VT-KC-034'),('VT-QC-054','VT-QC-051'),
 ('VT-RTG-040','VT-RTG-039'),('VT-RTG-055','VT-RTG-054'),('VT-TK-028','VT-TK-013'),('VT-TK-029','VT-TK-014')
), ids as (
 select duplicate.id duplicate_id,canonical.id canonical_id
 from mapping join public.materials duplicate on duplicate.code=mapping.duplicate_code
 join public.materials canonical on canonical.code=mapping.canonical_code and canonical.workspace_id=duplicate.workspace_id
)
update public.voucher_lines line set material_id=ids.canonical_id from ids where line.material_id=ids.duplicate_id;

with names(code,duplicate_code,name) as (values
 ('VT-KC-007','VT-KC-047','Bộ truyền động ra vào vị trí 20/40'' (PLD-110630R1)'),
 ('VT-KC-034','VT-KC-060','Rô tuyn khung cẩu QC MES Nhật (SM1-18)'),
 ('VT-QC-051','VT-QC-054','Khớp ly hợp điện từ cơ cấu tời (Stromag ZHA 250/53005111)')
)
update public.materials material set name=names.name from names where material.code=names.code
and exists(select 1 from public.materials duplicate where duplicate.workspace_id=material.workspace_id and duplicate.code=names.duplicate_code);

with mapping(duplicate_code,canonical_code) as (values
 ('VT-CC-003','VT-CC-002'),('VT-KC-047','VT-KC-007'),('VT-KC-060','VT-KC-034'),('VT-QC-054','VT-QC-051'),
 ('VT-RTG-040','VT-RTG-039'),('VT-RTG-055','VT-RTG-054'),('VT-TK-028','VT-TK-013'),('VT-TK-029','VT-TK-014')
)
delete from public.materials duplicate using mapping,public.materials canonical
where duplicate.code=mapping.duplicate_code and canonical.code=mapping.canonical_code and canonical.workspace_id=duplicate.workspace_id;

create function private.normalize_material_identity(value text) returns text
language sql immutable strict parallel safe set search_path='' as $$
select regexp_replace(lower(translate(value,
 'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
 'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUYYYYYDaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiioooooooooooooooooouuuuuuuuuuyyyyyd')),'[^a-z0-9]+','','g');
$$;
revoke all on function private.normalize_material_identity(text) from public,anon,authenticated;

create unique index materials_workspace_group_identity_uidx on public.materials(
 workspace_id,
 (coalesce(equipment_category,nullif(split_part(code,'-',2),''),'UNCLASSIFIED')),
 (private.normalize_material_identity(name)),
 (private.normalize_material_identity(unit))
);

commit;

