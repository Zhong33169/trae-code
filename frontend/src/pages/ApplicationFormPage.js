import { LitElement, html } from 'lit';
import { request, showToast } from '../utils.js';

class ApplicationFormPage extends LitElement {
  static properties = {
    user: { type: Object },
    loading: { type: Boolean },
    form: { type: Object },
  };

  constructor() {
    super();
    this.loading = false;
    this.form = {
      applicantName: '',
      applicantIdCard: '',
      applicantPhone: '',
      applicantAddress: '',
      waterUsageType: '',
      propertyType: '',
      idCardFrontImg: '',
      idCardBackImg: '',
      propertyCertificate: '',
    };
  }

  createRenderRoot() { return this; }

  updateField(k, v) { this.form = { ...this.form, [k]: v }; }

  validate() {
    const f = this.form;
    const required = [
      ['applicantName', '申请人姓名'],
      ['applicantIdCard', '身份证号'],
      ['applicantPhone', '联系电话'],
      ['applicantAddress', '申请地址'],
      ['waterUsageType', '用水类型'],
      ['propertyType', '房屋性质'],
    ];
    for (const [k, name] of required) {
      if (!f[k]) { showToast('请填写' + name, 'warning'); return false; }
    }
    if (!/^1[3-9]\d{9}$/.test(f.applicantPhone)) {
      showToast('联系电话格式不正确', 'warning'); return false;
    }
    if (!/(^\d{15}$)|(^\d{17}(\d|X|x)$)/.test(f.applicantIdCard)) {
      showToast('身份证号格式不正确', 'warning'); return false;
    }
    return true;
  }

  async submit(submitNow) {
    if (!this.validate()) return;
    if (submitNow) {
      const imgs = [
        ['idCardFrontImg', '身份证正面照'],
        ['idCardBackImg', '身份证反面照'],
        ['propertyCertificate', '房产证明'],
      ];
      for (const [k, name] of imgs) {
        if (!this.form[k]) {
          showToast('提交审核需要上传' + name + '，请使用模拟URL占位', 'warning');
          this.updateField(k, '/mock/placeholder_' + k + '.jpg');
          this.requestUpdate();
        }
      }
    }
    this.loading = true;
    try {
      const data = await request('/applications', {
        method: 'POST',
        body: { ...this.form, submitNow },
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        setTimeout(() => {
          location.hash = '#/applications/' + data.data.id;
        }, 600);
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast(e.message || '提交失败', 'error');
    } finally {
      this.loading = false;
    }
  }

  back() { history.back(); }

  fillMock() {
    this.form = {
      applicantName: '测试用户' + Math.floor(Math.random() * 1000),
      applicantIdCard: '11010119900101' + String(Math.floor(Math.random() * 9000) + 1000),
      applicantPhone: '138' + String(Math.floor(Math.random() * 90000000) + 10000000),
      applicantAddress: '北京市朝阳区测试街道' + Math.floor(Math.random() * 100) + '号',
      waterUsageType: '居民生活用水',
      propertyType: '商品房',
      idCardFrontImg: '/mock/id_front_' + Date.now() + '.jpg',
      idCardBackImg: '/mock/id_back_' + Date.now() + '.jpg',
      propertyCertificate: '/mock/property_' + Date.now() + '.jpg',
    };
    showToast('已填入测试数据，可直接提交', 'info');
  }

  render() {
    return html`
      <div class="page-wrap">
        <div class="card">
          <div class="card-title">
            <span>新建开户申请</span>
            <span>
              <button class="btn" @click="${this.fillMock}">填入测试数据</button>
              <button class="btn" @click="${this.back}">返回列表</button>
            </span>
          </div>

          <div class="section-title">申请人基本信息</div>
          <div class="form-row">
            <div class="form-item">
              <label class="required">申请人姓名</label>
              <input type="text" placeholder="请输入真实姓名"
                .value="${this.form.applicantName}"
                @input="${(e) => this.updateField('applicantName', e.target.value)}"
              />
            </div>
            <div class="form-item">
              <label class="required">身份证号码</label>
              <input type="text" placeholder="18位身份证号码"
                .value="${this.form.applicantIdCard}"
                @input="${(e) => this.updateField('applicantIdCard', e.target.value)}"
              />
            </div>
            <div class="form-item">
              <label class="required">联系电话</label>
              <input type="text" placeholder="11位手机号码"
                .value="${this.form.applicantPhone}"
                @input="${(e) => this.updateField('applicantPhone', e.target.value)}"
              />
            </div>
            <div class="form-item">
              <label class="required">用水地址</label>
              <input type="text" placeholder="请输入详细的用水地址"
                .value="${this.form.applicantAddress}"
                @input="${(e) => this.updateField('applicantAddress', e.target.value)}"
              />
            </div>
            <div class="form-item">
              <label class="required">用水类型</label>
              <select
                .value="${this.form.waterUsageType}"
                @change="${(e) => this.updateField('waterUsageType', e.target.value)}"
              >
                <option value="">请选择用水类型</option>
                <option value="居民生活用水">居民生活用水</option>
                <option value="商业用水">商业用水</option>
                <option value="工业用水">工业用水</option>
                <option value="行政事业用水">行政事业用水</option>
                <option value="特种行业用水">特种行业用水</option>
              </select>
            </div>
            <div class="form-item">
              <label class="required">房屋性质</label>
              <select
                .value="${this.form.propertyType}"
                @change="${(e) => this.updateField('propertyType', e.target.value)}"
              >
                <option value="">请选择房屋性质</option>
                <option value="商品房">商品房</option>
                <option value="经济适用房">经济适用房</option>
                <option value="公房">公房</option>
                <option value="商铺">商铺</option>
                <option value="厂房">厂房</option>
                <option value="写字楼">写字楼</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>

          <div class="section-title">证明材料（提交审核时必填，可填模拟URL）</div>
          <div class="form-row">
            <div class="form-item">
              <label>身份证正面照片 URL</label>
              <input type="text" placeholder="/mock/id_front.jpg"
                .value="${this.form.idCardFrontImg}"
                @input="${(e) => this.updateField('idCardFrontImg', e.target.value)}"
              />
            </div>
            <div class="form-item">
              <label>身份证反面照片 URL</label>
              <input type="text" placeholder="/mock/id_back.jpg"
                .value="${this.form.idCardBackImg}"
                @input="${(e) => this.updateField('idCardBackImg', e.target.value)}"
              />
            </div>
            <div class="form-item" style="grid-column: span 2;">
              <label>房产证明（产权证/购房合同） URL</label>
              <input type="text" placeholder="/mock/property.jpg"
                .value="${this.form.propertyCertificate}"
                @input="${(e) => this.updateField('propertyCertificate', e.target.value)}"
              />
            </div>
          </div>

          <div style="display:flex;justify-content:center;gap:12px;margin-top:24px;">
            <button class="btn" @click="${this.back}" ?disabled="${this.loading}">取消</button>
            <button class="btn" @click="${() => this.submit(false)}" ?disabled="${this.loading}">保存草稿</button>
            <button class="btn btn-primary" @click="${() => this.submit(true)}" ?disabled="${this.loading}">
              ${this.loading ? '提交中...' : '保存并提交审核'}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('application-form-page', ApplicationFormPage);
