import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'acl-audit-create': {
                        table: 'sys_security_acl'
                        id: 'e0079a9e57be467b94ac59e6ddb617b9'
                    }
                    'acl-audit-read': {
                        table: 'sys_security_acl'
                        id: '7638b54b4b3c48f4a0338091585485b6'
                    }
                    'acl-run-create': {
                        table: 'sys_security_acl'
                        id: '4dfedd8032fd4606b01702968f568fb4'
                    }
                    'acl-run-delete': {
                        table: 'sys_security_acl'
                        id: 'c4d8baab1d5c4bd59c80b7b8930e736d'
                    }
                    'acl-run-read': {
                        table: 'sys_security_acl'
                        id: 'b5ad1be2165b4e7bb682f88c140137c2'
                    }
                    'acl-run-write': {
                        table: 'sys_security_acl'
                        id: 'd9f189d4511546fdbcc03fae8da4a7dd'
                    }
                    'agent-doctor': {
                        table: 'sn_aia_agent'
                        id: 'e1392946828940e5a708fc51b0a5e954'
                    }
                    'agent-doctor-acl': {
                        table: 'sys_security_acl'
                        id: 'ef1f815d97a0431e8b87f4a055ba5b3d'
                    }
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
                    'pa-artifact-store': {
                        table: 'sys_script_include'
                        id: 'fb2d4b7e7c794f8b956cc1a8eb3871f6'
                    }
                    'pa-audit-logger': {
                        table: 'sys_script_include'
                        id: '2fc5b74bb9f4425b846022e1572ed294'
                    }
                    'pa-run-anchor': {
                        table: 'sys_script_include'
                        id: '442109ddbf1c459d919c2b04ffa9e71f'
                    }
                    'pa-script-tool-adapter': {
                        table: 'sys_script_include'
                        id: '8adcc81877fb40be96f1422c18682b5b'
                    }
                    'pa-tool-agent-trace': {
                        table: 'sys_script_include'
                        id: 'e460c4021e4b44dcaf92570057d5a360'
                    }
                    'pa-tool-read-artifact': {
                        table: 'sys_script_include'
                        id: '3979cce296d748edac6f85de1d9136a5'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '296e46a72ad14ef5a7f123411966e86e'
                    }
                    'scope-probe-adapter': {
                        table: 'sys_ws_operation'
                        id: '41e02cdf0a3f40aba13d2e4f4a71178a'
                    }
                    'scope-probe-anchor-selftest': {
                        table: 'sys_ws_operation'
                        id: '89ad8ce31da841608b1514bc1644b3a7'
                    }
                    'scope-probe-api': {
                        table: 'sys_ws_definition'
                        id: '29747bd00742435e8884e7311ef6a7df'
                    }
                    'scope-probe-artifact-selftest': {
                        table: 'sys_ws_operation'
                        id: '1fc74db242f84cc79c489e4a72c6ec35'
                    }
                    'scope-probe-reads': {
                        table: 'sys_ws_operation'
                        id: 'a04ccacf0888461d84eb46c0e0d14752'
                    }
                    'scope-probe-trace': {
                        table: 'sys_ws_operation'
                        id: '074e8ea6df954aeb9a92cc93f586b790'
                    }
                    'scope-probe-v1': {
                        table: 'sys_ws_version'
                        id: '75b650020ec04fd8a583813797f4e91c'
                    }
                    src_server_PaArtifactStore_js: {
                        table: 'sys_module'
                        id: 'c3643d5da7cd404581a5fc2116ee5661'
                    }
                    src_server_PaAuditLogger_js: {
                        table: 'sys_module'
                        id: 'c858e2de4e114366a52544c1f671af59'
                    }
                    src_server_PaRunAnchor_js: {
                        table: 'sys_module'
                        id: 'bb0b6de06e71450e9fbeec1f74f4fa3f'
                    }
                    src_server_PaScriptToolAdapter_js: {
                        table: 'sys_module'
                        id: '5a54685b6fd04426acc3bb39714b0f4f'
                    }
                    src_server_script_ts: {
                        table: 'sys_module'
                        id: 'd8226c63fd0d44bea250580a81a4424c'
                    }
                    src_server_tools_PaToolAgentTrace_js: {
                        table: 'sys_module'
                        id: 'cae852b254fc45a8ac5bd32c712102be'
                    }
                    src_server_tools_PaToolReadArtifact_js: {
                        table: 'sys_module'
                        id: '023a0738182045e3aedaecd5ea2478f3'
                    }
                    'xsp-syslog-read': {
                        table: 'sys_scope_privilege'
                        id: '8b8a75b6d0fe4826b54854d2c38202a1'
                    }
                }
                composite: [
                    {
                        table: 'sys_choice_set'
                        id: '0131cdbf57a04331ba142c6716e8fd66'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '0154a35691fd416a8364bcab414fd5a9'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: '387983889a1845e8ac55829bef5b238e'
                            name: 'agent_trace'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '04afae7468e4448c9cdac78ccad6155b'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'queued'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '08ed366a6f0d4faf9a3f3299c582de24'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'run'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0994f4a0115d478fbdc7b47f91254e48'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_table'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0a04be84c4094640b0306c4b24c18c0e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '0fccd2ef201f48cc83f7c7f45e3e0d47'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            value: 'diagnose'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '108e12b3b9dd412bb70080dbd402d80f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_record'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '10f1be2b7d0f430c9fd090f53085f8e4'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '16e086f1163344d6a85201a5eb2b1402'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '17db68e8acae422f8359af0898ed4a1e'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'tool_name'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1897483989964a4e9b1c201a2e4d6510'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'output'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1b2bcc9306a44d3798373e7315fc5589'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '1b51f2ab0150458f92ce7a480768421c'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '23796a4558eb4d2993c74f4739c5780b'
                        key: {
                            sys_security_acl: '7638b54b4b3c48f4a0338091585485b6'
                            sys_user_role: {
                                id: '8c13403abda74dcb9964e5962f58d64a'
                                key: {
                                    name: 'x_snc_troubleshoot.user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '2c2275e6cbab48839dadfaf7babbbb4d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '2c79075668814bd4ac3e9d49e3398274'
                        key: {
                            sys_security_acl: '7638b54b4b3c48f4a0338091585485b6'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2f3bb55bc44b44bb9caf2531b747c398'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'confirmed_by_user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '30e39ab94fbc4d25ae5d0af0e7b372d1'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'error'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '318421a325064300976fb6db3dc504e2'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '355e171426154b1c96417e39e8867ff5'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'number'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '35ec448bf4d04ce9887d422248d63b05'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'transcript'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '387983889a1845e8ac55829bef5b238e'
                        key: {
                            name: 'agent_trace'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3faf6ce2337f4a788e65d7775f455c59'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '403c548d45744a5ba338f8c94498c846'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'awaiting_confirmation'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '42df543a92014e3d990882228ada7b37'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'number'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '43decf18ea994543a6a20665ce3019a4'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'input'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '43ebe4750f814df2ad0b015099662199'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                        }
                    },
                    {
                        table: 'sn_aia_agent_config'
                        id: '4874f8bc13c94fa9a70dae46abc8ba1e'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '49d6897bf9634285b0b16b5ecc563fcb'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'running'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '4c5f3341253f421b858515ee09681978'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '5031f75b5db84bb688f5f32efc87b300'
                        key: {
                            sys_security_acl: 'b5ad1be2165b4e7bb682f88c140137c2'
                            sys_user_role: {
                                id: '8c13403abda74dcb9964e5962f58d64a'
                                key: {
                                    name: 'x_snc_troubleshoot.user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5119101ad8164717b5598da0a5bbed95'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'result'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5489cc6ce32a41c28b9ca5dd93b6f3d7'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'error'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '560af908094241e6861ec7b6b2ef5131'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'failed'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5a0deab2cb8d4dcb8e1d23b08bef978b'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'confirmed_by_user'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5dc93bd2dbca430c8890c6ff86a68674'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'input'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '6271a9fc390a4edaa4c7c7690c4f926f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'error'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6c98730db77a48cfb9432b48dbc4c08d'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'output'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '6e1aabb23d1b44bd884e95f10bad970a'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '703209d664514cdfa8e685ae4217ef3c'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'run'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '738906ad7f7e4d7285321ebda9af58ab'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'transcript'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '77c616ea549b4ed9b7c3bdaf11001bdd'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'fix_report'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7b8cf0b5c1d741d59eaee936fd91150f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'tool_name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '81c9bd86ba584862bb3e214e45c5d712'
                        key: {
                            sys_security_acl: 'b5ad1be2165b4e7bb682f88c140137c2'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8414aa1467904d62848363f0bcf410ed'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'fix_report'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '89954005f8604ae4b31fd7fcc8668cf6'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'context_summary'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '89d4a576922f440a8d05def05fe22190'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_record'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '8a3200d5b9b244ba904f077116d7efd8'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8ae0768176ad4e0787db4ed54c62ac99'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'user'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8be57946d83748fc9dd920b38a1e2b0e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'agent'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: '8c13403abda74dcb9964e5962f58d64a'
                        key: {
                            name: 'x_snc_troubleshoot.user'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '8f0b2570c0b54f74af0c194bd2ec4e87'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'conversation_ref'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '8f969afae83946029a0d4359176869d5'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'complete'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8f9ab816e01a4f8080c169869a84c410'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '8fbd80e03b1d4d6c80f69db5b94823c2'
                        key: {
                            sys_security_acl: 'd9f189d4511546fdbcc03fae8da4a7dd'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '95fcfca298b2443a8258a77447c887a3'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'intent'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '9fb95833fdb24cfcaaad91cf0d756330'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: 'a0716c5ad77f42c29e1420b7f9009bda'
                            name: 'read_artifact'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: 'a0716c5ad77f42c29e1420b7f9009bda'
                        key: {
                            name: 'read_artifact'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'a21fd9a9cbe34fffb0160f84de1768f1'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'execution_ref'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'aac207cd6fe442b1bb882cddc594d962'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ac186115560d4319a2b05d8f427ffbb9'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'ae07caaf5a9946dfa518054480f173a0'
                        key: {
                            sys_security_acl: 'c4d8baab1d5c4bd59c80b7b8930e736d'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_number'
                        id: 'afcf5dd885ae4a0095ab49e7aa20db5e'
                        key: {
                            category: 'x_snc_troubleshoot_run'
                            prefix: 'TR'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b0b454d071d7469a9cc5207434bddac9'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'execution_ref'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'b69939bf9e8347aaba5568b133765d6d'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: 'c3c9f3a9863249f08abc0e7d01cba643'
                        key: {
                            name: 'x_snc_troubleshoot.admin'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'd311b03651b049aebadf6c3df8171f9e'
                        key: {
                            sys_security_acl: 'e0079a9e57be467b94ac59e6ddb617b9'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'd438363362a44ebdbf29e980286b246e'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd63fa9816f114c11b6fcec45a0e776ea'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            value: 'native'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e14289f28bcf4edb9e4fc876d0b3c4fc'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e15b8c3a42944b678f5befc7b85dcd58'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            value: 'custom'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'e2be7dd3c3ce45df961444fab8a50c51'
                        key: {
                            sys_security_acl: '4dfedd8032fd4606b01702968f568fb4'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e2c4dac7730949adb18751b6b0e7487e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e2cd0012ec8849bebcaf68b35053386c'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'user'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'e2ce17478fe24fd1968337f74e7bf353'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e37aa4ab5dee46c3863288b72969412d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'context_summary'
                        }
                    },
                    {
                        table: 'sn_aia_version'
                        id: 'e710ed445e8b42409684b1d1b50b3cee'
                        key: {
                            target_id: 'e1392946828940e5a708fc51b0a5e954'
                            version_name: 'V1'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ead6c0650cdc47a8be5306011ecc031d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'conversation_ref'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'f4d97983a6d84bb9a1635ec29dd579a6'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            value: 'collect'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f5756710075a469a94542cc0b3fae664'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'agent'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f7091ca902484dc39137810f2a7774e3'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fe2f89d952ab42dfbb3189862796f316'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            language: 'en'
                        }
                    },
                ]
            }
        }
    }
}
