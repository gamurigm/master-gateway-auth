package master_gateway.authz

import rego.v1

default allow := false

superadmin if input.subject.role_name in {"SUPER_ADMIN", "SUPERADMIN"}

has_permission(permission) if permission in input.subject.permissions

hard_delete_action if endswith(input.action, ":delete_hard")

target_is_superadmin if input.target.role_name in {"SUPER_ADMIN", "SUPERADMIN"}

target_permission_is_hard_delete if endswith(input.target.permission_code, ":delete_hard")

target_permission_is_delegable if input.target.permission_delegable == true

allow if superadmin

allow if {
  not superadmin
  input.action == "roles:create"
  has_permission("roles:create")
  not target_is_superadmin
}

allow if {
  not superadmin
  input.action == "roles:assign_permission"
  has_permission("roles:assign_permission")
  has_permission(input.target.permission_code)
  target_permission_is_delegable
  not target_is_superadmin
  not target_permission_is_hard_delete
}

allow if {
  not superadmin
  input.action == "roles:unassign_permission"
  has_permission("roles:unassign_permission")
  has_permission(input.target.permission_code)
  not target_is_superadmin
}

allow if {
  not superadmin
  input.action != "roles:create"
  input.action != "roles:assign_permission"
  input.action != "roles:unassign_permission"
  has_permission(input.action)
  not hard_delete_action
  not target_is_superadmin
}
