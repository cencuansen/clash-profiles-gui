<template>
  <div class="container">
    <div class="header">
      <el-button size="small" type="primary" @click="loadFile">加载</el-button>
      <el-button size="small" type="primary" @click="saveFile">保存</el-button>
    </div>

    <div class="main">
      <!-- Proxies 列表 -->
      <div class="proxies" :class="{ empty: proxies.length === 0 }">
        <div class="section-title">Proxies</div>
        <div class="proxy" v-for="(p, index) in proxies" :key="index">
          <el-text class="proxy-name" truncated>{{ p.name }}</el-text>
          <el-button type="danger" size="small" @click="deleteProxy(p.name, index)">
            <el-icon>
              <Delete />
            </el-icon>
          </el-button>
        </div>
      </div>

      <!-- Proxy-Groups 列表（手风琴） -->
      <div class="proxy-groups" :class="{ empty: groups.length === 0 }">
        <div class="section-title">Proxy Groups</div>
        <div class="group-input">
          <el-input v-model="newGroupName" size="small" placeholder="输入分组名称" @keyup.enter="addGroup"></el-input>
          <el-button type="primary" size="small" @click="addGroup">添加</el-button>
        </div>
        <el-collapse v-model="activeGroupName" accordion>
          <el-collapse-item v-for="(g, index) in groups" :key="index" :name="g.name">
            <template #title>
              <div class="group-header">
                <span>{{ g.name }}</span>
                <div>
                  <el-select v-model="g.type" size="small" style="width: 80px;" placeholder="选择类型" class="group-type"
                    @click.stop @change="() => { }">
                    <el-option v-for="gt in groupTypes" :key="gt" :label="gt" :value="gt"></el-option>
                  </el-select>
                  <el-button type="danger" size="small" class="group-delete" @click.stop="deleteGroup(g.name, index)">
                    <el-icon>
                      <Delete />
                    </el-icon>
                  </el-button>
                </div>
              </div>
            </template>
            <el-checkbox-group v-model="g.proxies" @change="updateGroupProxies(g.name, $event)">
              <div class="proxy-row" v-for="(p, pIndex) in paginatedGroupProxies[g.name]" :key="p">
                <el-checkbox :label="p" :disabled="p === 'DIRECT'">{{ p }}</el-checkbox>
              </div>
            </el-checkbox-group>
            <el-pagination v-model:current-page="groupCurrentPage[g.name]" :page-size="groupPageSize"
              :total="(proxies?.length || 0) + 1" layout="prev, pager, next" size="small"
              @current-change="handleGroupPageChange(g.name)"></el-pagination>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- Rules 手风琴 -->
      <div class="rules">
        <div class="section-title">Rules</div>
        <el-collapse v-model="activeRuleType" accordion>
          <el-collapse-item v-for="type in ruleTypes" :key="type" :name="type" :title="type">
            <template #title>
              <div class="rule-header">
                <span>{{ type }} ({{ rules[type]?.length || 0 }})</span>
                <el-select v-if="(rules[type]?.length || 0) > 0" v-model="batchGroup[type]" size="small"
                  placeholder="选择分组" class="batch-group" clearable @click.stop
                  @change="batchUpdateRuleGroup(type, $event)">
                  <el-option v-for="group in groups" :key="group.name" :label="group.name"
                    :value="group.name"></el-option>
                  <el-option label="DIRECT" value="DIRECT"></el-option>
                </el-select>
              </div>
            </template>

            <div class="rule-input">
              <el-input class="input-rule" v-model="newRule[type]" size="small" placeholder="输入" clearable
                @input="debouncedFilterRules(type)" @keyup.enter="addRule(type)"></el-input>
              <el-button class="add-rule" type="primary" size="small" @click="addRule(type)">添加</el-button>
            </div>
            <div class="rule-content">
              <div class="rule-row" v-for="(r, index) in paginatedRules[type]" :key="index">
                <div class="rule-name" v-html="highlightRule(r.rule, newRule[type])"></div>
                <el-select v-model="r.group" size="small" placeholder="选择分组" class="rule-group"
                  @change="updateRuleGroup(type, rules[type].indexOf(r.rule), $event)">
                  <el-option v-for="group in groups" :key="group.name" :label="group.name"
                    :value="group.name"></el-option>
                  <el-option label="DIRECT" value="DIRECT"></el-option>
                </el-select>
                <el-button type="danger" size="small" @click="deleteRule(type, rules[type].indexOf(r.rule))">
                  <el-icon>
                    <Delete />
                  </el-icon>
                </el-button>
              </div>
            </div>
            <el-pagination v-model:current-page="currentPage[type]" :page-size="pageSize"
              :total="filteredRules[type].length" layout="prev, pager, next" size="small"
              @current-change="handlePageChange(type)"></el-pagination>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import yaml from 'js-yaml';
import { ipcRenderer } from 'electron';
import { ElMessage } from 'element-plus';

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

const defaultGroup = '代理';

const originalData = reactive({});
const rules = ref({});
const newRule = ref({});
const filteredRules = ref({});
const paginatedRules = ref({});
const currentPage = ref({});
const pageSize = 10; // 每页规则数
const groupCurrentPage = ref({});
const groupPageSize = 10; // 每页代理数
const ruleTypes = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'GEOIP',
  'IP-CIDR',
  'SRC-IP-CIDR',
  'DST-PORT',
  'SRC-PORT',
  'MATCH',
];
const groupTypes = [
  'url-test',
  'fallback',
  'select',
  'load-balance',
];
const proxies = ref([]);
const groups = ref([]);
const newGroupName = ref('');
const activeRuleType = ref(''); // 默认展开第一个规则类型
const activeGroupName = ref(''); // 默认展开第一个分组
const batchGroup = ref({}); // 批量选择分组
const paginatedGroupProxies = ref({});

// 初始化数据
ruleTypes.forEach((type) => {
  newRule.value[type] = '';
  filteredRules.value[type] = [];
  paginatedRules.value[type] = [];
  currentPage.value[type] = 1;
  batchGroup.value[type] = '';
});

// 防抖过滤函数
const filterRules = (type) => {
  console.log('rules.value[type]', rules.value[type]);

  const query = newRule.value[type].trim().toLowerCase();
  filteredRules.value[type] = query
    ? rules.value[type].map((rule, index) => ({ rule, group: rules.value[type + '_group'][index] || defaultGroup }))
      .filter((item) => item.rule.toLowerCase().includes(query))
    : rules.value[type].map((rule, index) => ({ rule, group: rules.value[type + '_group'][index] || defaultGroup }));
  currentPage.value[type] = 1;
  updatePaginatedRules(type);
};
const debouncedFilterRules = debounce(filterRules, 300);

const loadFile = () => {
  ipcRenderer.send('load-profile');
};

ipcRenderer.on('profile-loaded', (event, content) => {
  originalData.value = yaml.load(content);

  // 初始化 rules 和 groups
  const rulesByType = {};
  const groupsByType = {};
  for (const ruleRow of originalData.value.rules || []) {
    const [type, rule, group = defaultGroup] = ruleRow.split(',');
    if (!rulesByType[type]) {
      rulesByType[type] = [];
      groupsByType[type] = [];
    }
    rulesByType[type].push(rule);
    groupsByType[type].push(group);
  }
  ruleTypes.forEach((type) => {
    rules.value[type] = rulesByType[type] || [];
    rules.value[type + '_group'] = groupsByType[type] || rulesByType[type]?.map(() => defaultGroup) || [];

    filteredRules.value[type] = rules.value[type]?.map((rule, index) => ({
      rule,
      group: rules.value[type + '_group'][index] || defaultGroup,
    }));
    currentPage.value[type] = 1;
    updatePaginatedRules(type);
  });

  // 初始化 proxies 和 groups
  proxies.value = originalData.value.proxies || [];
  groups.value = originalData.value['proxy-groups'] || [];
  groups.value.forEach((g) => {
    groupCurrentPage.value[g.name] = 1;
    updatePaginatedGroupProxies(g.name);
    if (!g.proxies.includes('DIRECT')) {
      g.proxies.unshift('DIRECT'); // 确保 DIRECT 在首位
    }
  });
  if (groups.value.length > 0) {
    activeGroupName.value = groups.value[0].name; // 默认展开第一个分组
  }
});

ipcRenderer.on('profile-saved', (event, isOk) => {
  if (isOk) {
    ElMessage.success('保存成功');
  } else {
    ElMessage.error('保存失败');
  }
});

const addRule = (type) => {
  const rule = newRule.value[type].trim();
  if (!rule) {
    ElMessage.warning('请输入规则内容');
    return;
  }
  if (rules.value[type].includes(rule)) {
    ElMessage.error('规则已存在');
    return;
  }
  rules.value[type].unshift(rule);
  rules.value[type + '_group'].unshift(defaultGroup);
  newRule.value[type] = '';
  filterRules(type);
  ElMessage.success('规则添加成功');
};

const deleteRule = (type, index) => {
  rules.value[type].splice(index, 1);
  rules.value[type + '_group'].splice(index, 1);
  filterRules(type);
};

const updateRuleGroup = (type, index, group) => {
  rules.value[type + '_group'][index] = group;
  if (type === 'MATCH') {
    // console.log('rules.value', rules.value);
    rules.value['MATCH'] = [group];
  }
  filterRules(type);
};

const batchUpdateRuleGroup = (type, group) => {
  if (group) {
    rules.value[type + '_group'] = rules.value[type].map(() => group);
    if (type === 'MATCH') {
      // console.log('rules.value', rules.value);
      rules.value['MATCH'] = [group];
    }
    filterRules(type);
  }
};

const updatePaginatedRules = (type) => {
  const start = (currentPage.value[type] - 1) * pageSize;
  const end = start + pageSize;
  paginatedRules.value[type] = filteredRules.value[type].slice(start, end);
};

const handlePageChange = (type) => {
  updatePaginatedRules(type);
};

const addGroup = () => {
  const name = newGroupName.value.trim();
  if (!name) {
    ElMessage.warning('请输入分组名称');
    return;
  }
  if (groups.value.some((g) => g.name === name)) {
    ElMessage.error('分组已存在');
    return;
  }
  const newGroup = {
    name,
    type: 'select',
    proxies: ['DIRECT', ...proxies.value.map((p) => p.name)], // 默认关联所有 proxy
  };
  groups.value.push(newGroup);
  groupCurrentPage.value[name] = 1;
  updatePaginatedGroupProxies(name);
  newGroupName.value = '';
  activeGroupName.value = name; // 展开新添加的分组
  ElMessage.success('分组添加成功');
};

const deleteGroup = (name, index) => {
  if (name === defaultGroup) {
    ElMessage.error('默认分组不可删除');
    return;
  }
  // 将关联该分组的规则设置为 DIRECT
  ruleTypes.forEach((type) => {
    rules.value[type + '_group'] = rules.value[type + '_group'].map((g) => (g === name ? 'DIRECT' : g));
    filterRules(type);
  });
  groups.value.splice(index, 1);
  delete groupCurrentPage.value[name];
  delete paginatedGroupProxies.value[name];

  // 分组可以关联分组，同时删掉其他分组对当前分组的引用
  groups.value.forEach(g => {
    g.proxies = g.proxies.filter(p => p !== name);
  });

  ElMessage.success('分组删除成功');
};

const deleteProxy = (name, index) => {
  const isUsed = groups.value.some((g) => g.proxies.includes(name));
  if (isUsed) {
    // 从所有分组中移除该 proxy
    groups.value.forEach((g) => {
      g.proxies = g.proxies.filter((p) => p !== name);
      updatePaginatedGroupProxies(g.name);
    });
  }
  proxies.value.splice(index, 1);
};

const updateGroupProxies = (groupName, selectedProxies) => {
  const group = groups.value.find((g) => g.name === groupName);
  if (!selectedProxies.includes('DIRECT')) {
    selectedProxies.unshift('DIRECT'); // 强制保留 DIRECT
  }
  group.proxies = selectedProxies;
  updatePaginatedGroupProxies(groupName);
};

const updatePaginatedGroupProxies = (groupName) => {
  const allProxies = proxies.value.map((p) => p.name).filter((n) => n !== 'DIRECT');
  const groupPorxies = groups.value.filter(x => x.name === groupName)[0].proxies.filter(x => x !== 'DIRECT' && !allProxies.includes(x));
  const mergedProxies = ['DIRECT', ...groupPorxies, ...allProxies];

  console.log('allProxies', allProxies);
  console.log('groups.value', groups.value);
  console.log('groupPorxies', groupPorxies);
  console.log('mergedProxies', mergedProxies);


  const start = (groupCurrentPage.value[groupName] - 1) * groupPageSize;
  const end = start + groupPageSize;
  paginatedGroupProxies.value[groupName] = mergedProxies.slice(start, end);
};

const handleGroupPageChange = (groupName) => {
  updatePaginatedGroupProxies(groupName);
};

const saveFile = () => {
  const outputRules = [];
  for (const type of ruleTypes) {
    if (rules.value[type]) {
      const typeRules = rules.value[type]
        .map((line, index) => {
          const group = rules.value[type + '_group'][index] || defaultGroup;
          return type === 'MATCH' ? `${type},${line}` : `${type},${line},${group}`;
        })
        .filter((rule) => rule.split(',')[1].trim());
      outputRules.push(...typeRules);
    }
  }

  const outputData = { ...originalData.value };
  outputData.proxies = proxies.value;
  outputData['proxy-groups'] = groups.value;
  outputData.rules = outputRules;

  const yamlStr = yaml.dump(outputData);
  // ipcRenderer.send('save-profile', yamlStr);
  debounce(ipcRenderer.send, 300)('save-profile', yamlStr);
};

const highlightRule = (rule, query) => {
  if (!query) return rule;
  const regex = new RegExp(`(${query})`, 'gi');
  return rule.replace(regex, '<span class="highlight">$1</span>');
};
</script>

<style>
.container {
  padding: 10px;
  display: flex;
  flex-direction: column;
  height: 90vh;
  overflow: hidden;
}

.header {
  margin-bottom: 10px;
  flex-shrink: 0;
  /* 防止 .header 被压缩 */
}

.main {
  display: flex;
  gap: 16px;
  flex: 1;
  overflow: hidden;
}

.section-title {
  font-weight: bold;
  margin-bottom: 8px;
}

.proxies,
.proxy-groups {
  border-radius: 5px;
  flex: 0 0 250px;
  overflow-y: auto;
}

.proxy,
.group {
  display: flex;
  align-items: center;
  padding: 3px 5px;
}

.proxy-name,
.group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-input {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
}

.group-delete {
  margin-left: 8px;
}

.proxy-groups .el-collapse {
  border: none;
}

.proxy-groups .el-collapse-item__header {
  font-weight: bold;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
}

.proxy-row {
  padding: 3px 5px;
}

.rules {
  flex: 1;
  /* height: 500px; */
  height: 100%;
  overflow-x: auto;
  padding: 8px;
}

.el-collapse {
  border: none;
}

.el-collapse-item__header {
  font-weight: bold;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 8px;
}

.batch-group {
  width: 120px;
}

.rule-input {
  display: flex;
  gap: 8px;
  padding: 5px 0;
}

.input-rule input {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
}

.add-rule {
  padding: 3px;
}

.rule-content {
  max-height: 250px;
  overflow-y: auto;
}

.rule-row {
  display: flex;
  align-items: center;
  padding: 3px 5px;
  gap: 8px;
}

.rule-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
}

.rule-group {
  width: 120px;
}

.rule-row:nth-child(odd) {}

.rule-row:nth-child(even) {}

.highlight {
  color: red;
}

.empty {}

::-webkit-scrollbar {
  height: 8px;
  width: 8px;

  display: none;
}

::-webkit-scrollbar-thumb {
  background: #dcdcdc;
  border-radius: 4px;
}

::-webkit-scrollbar-track {
  background: #f5f5f5;
}
</style>