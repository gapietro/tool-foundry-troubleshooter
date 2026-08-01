import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: 'ad714b275f324ba79ba057c420861e08'
                    }
                    br0: {
                        table: 'sys_script'
                        id: '74432594faa840ef98ffbe85e2168cc5'
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: '03317942948949a1b8adfec10ad60843'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: 'ad7f8559341f4c86bc9db1ecf47441a9'
                    }
                    src_server_script_ts: {
                        table: 'sys_module'
                        id: '30055670e07444bd993faecf66d51bc8'
                    }
                }
            }
        }
    }
}
