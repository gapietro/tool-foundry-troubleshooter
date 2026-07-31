import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: 'cfd6e48922964e20ade700d69db34931'
                    }
                    br0: {
                        table: 'sys_script'
                        id: '85b27e4c889943a1bb30af6a98e2ab33'
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: 'af760ca041894ddd9b914b5af65cb766'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '296e46a72ad14ef5a7f123411966e86e'
                    }
                    'scope-probe-api': {
                        table: 'sys_ws_definition'
                        id: '29747bd00742435e8884e7311ef6a7df'
                    }
                    'scope-probe-reads': {
                        table: 'sys_ws_operation'
                        id: 'a04ccacf0888461d84eb46c0e0d14752'
                    }
                    'scope-probe-v1': {
                        table: 'sys_ws_version'
                        id: '75b650020ec04fd8a583813797f4e91c'
                    }
                    src_server_script_ts: {
                        table: 'sys_module'
                        id: 'd8226c63fd0d44bea250580a81a4424c'
                    }
                }
            }
        }
    }
}
