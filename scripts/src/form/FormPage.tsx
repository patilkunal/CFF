/// <reference path="./interfaces.d.ts"/>
import React from 'react';
import Form from 'react-jsonschema-form';
import {API} from "aws-amplify";
import createSchemas from "src/common/CreateSchemas"

import DOMPurify from 'dompurify';
import { get, set, unset } from "lodash-es";
import "./form.scss";
import CustomForm from "./CustomForm";
import FormConfirmationPage from "./FormConfirmationPage";
import Loading from "src/common/Loading/Loading";
import FormLoader from "src/common/FormLoader";
import {connect} from "react-redux";
import {logout} from "src/store/auth/actions";
import {setFormLoading} from "src/store/form/actions";
import {Helmet} from "react-helmet";
import htmlToText from "html-to-text";
import Login from "src/common/Login/Login";

const STATUS_FORM_LOADING = 0;
const STATUS_FORM_RENDERED = 2;
const STATUS_FORM_CONFIRMATION = 4;
const STATUS_FORM_PAYMENT_SUCCESS = 6;
const STATUS_FORM_DONE = 8;

const mapStateToProps = state => ({
  ...state.form,
  auth: state.auth
});

const mapDispatchToProps = (dispatch, ownProps) => ({
  logout: () => dispatch(logout()),
  setFormLoading: (e) => dispatch(setFormLoading(e))
});


var This;
//const log = (type: {}) => console.log.bind(console, type);
const log = console.log;

class FormPage extends React.Component<IFormPageProps, IFormPageState> {
  constructor(props: any) {
    super(props);
    This = this;
    this.state = {
      status: STATUS_FORM_LOADING,
      hasError: false,
      errorMessage: "",
      schemaMetadata: {},
      schema: { "title": "None", "type": "object" },
      uiSchema: { "title": "status" },
      formOptions: {},
      step: 0,
      paymentInfo: null,
      paymentMethods: null,
      paymentInfo_received: null,
      paymentCalcInfo: null,
      paymentStarted: false,
      data: null,
      responseId: undefined,
      ajaxLoading: false,
      responseData: undefined
    };
    
  }

  componentDidUpdate(prevProps) {
    if (this.props.auth.loggedIn && this.state.responseId === undefined && this.state.status != STATUS_FORM_LOADING) {
      this.loadResponse();
    }
  }
  componentDidCatch(error, info) {
    // Display fallback UI
    error = error.toString();
    if (this.state.hasError) {
     
      this.setState({ hasError: true, errorMessage: this.state.errorMessage + "\n\n" + JSON.stringify(error, null, 2) });
    }
    else {
      this.setState({ hasError: true, errorMessage: JSON.stringify(error, null, 2) });
    }
    
    // You can also log the error to an error reporting service
    console.log("caught");
    console.error(error, info);
  }
  handleError(e) {
    console.error("ERROR", e);
    this.props.logout();
    this.setState({"hasError": true});
  }
  componentDidMount() {
    this.loadForm();
  }
  loadForm() {
      this.setState({status: STATUS_FORM_LOADING});
      if (this.props.form_preloaded) {
        let cs = createSchemas(this.props.form_preloaded);
        let { schemaMetadata, uiSchema, schema, defaultFormData, paymentCalcInfo } = cs;
        this.setState({ schemaMetadata, uiSchema, schema,
          status: STATUS_FORM_RENDERED,
          data: defaultFormData,
          paymentCalcInfo
        });
        this.props.onFormLoad && this.props.onFormLoad(schema, uiSchema);
        return;
      }
      FormLoader.getFormAndCreateSchemas("", this.props.formId, "", this.props.specifiedShowFields, (e) => this.handleError(e))
      .then(({ schemaMetadata, uiSchema, schema, defaultFormData, paymentCalcInfo, formOptions }) => {
        this.setState({ schemaMetadata, uiSchema, schema,
          status: STATUS_FORM_RENDERED,
          data: defaultFormData,
          paymentCalcInfo,
          formOptions
        });
        this.props.onFormLoad && this.props.onFormLoad(schema, uiSchema);
      });
    // }

  }
  loadResponse() {
    this.setState({status: STATUS_FORM_LOADING});
    API.get("CFF", `forms/${this.props.formId}/response`, {}).then(e => {
      let res = e.res;
      this.setState({
        status: STATUS_FORM_RENDERED,
        responseId: res ? res._id.$oid : null,
        responseData: res ? res.value: null,
        data: res ? res.value: this.state.data
      })
    });
  }
  goBackToFormPage() {
    This.setState({ status: STATUS_FORM_RENDERED });
  }
  onPaymentComplete(e) {
    this.setState({
      "status": STATUS_FORM_PAYMENT_SUCCESS
    });
  }
  onSubmit(data: { formData: {} }) {
    let formData = data.formData;
    let payload = {
      "data": formData,
      "modifyLink": (window.location != window.parent.location) ? document.referrer : window.location.href
    } // todo: include repsonse id for update.

    if (this.state.responseId) {
      payload["responseId"] = this.state.responseId;
    }
    this.setState({ajaxLoading: true});
    API.post("CFF", `forms/${this.props.formId}`, {
      "body": payload
    }).catch(e => {
      this.setState({ajaxLoading: false});
      alert("Error submitting the form. " + e);
    }).then((response) => {
      let res = response.res;
      if (!(res.success == true && res.responseId)) {
        this.setState({ajaxLoading: false});
        if (res.success == false && res.message) {
          if (res.fields_to_clear && res.fields_to_clear.length) {
            let formDataNew = formData;
            for (let field of res.fields_to_clear) {
              set(formDataNew, field, "");
            }
            this.setState({data: formDataNew});
          }
          throw "Error submitting the form: " + res.message;
        }
        else {
          throw "Response not formatted correctly: " + JSON.stringify(res);
        }
      }
      if (this.state.schemaMetadata.showConfirmationPage === false) {
        this.setState({
          ajaxLoading: false,
          status: STATUS_FORM_DONE
        })
        return;
      }
      let newResponse = res.action == "insert";
      let paymentInfo_received = null;
      if (!newResponse) {
        // Todo: get paymentInfo_received from server, too, even if it's a new response.
        paymentInfo_received = {"currency": res.amt_received.currency, "total": res.amt_received.total };
      }
      if (res.paid) {
        paymentInfo_received = res.paymentInfo
      }
      this.setState({
        ajaxLoading: false,
        status: STATUS_FORM_CONFIRMATION,
        data: formData,
        responseData: formData,
        responseId: res.responseId,
        paymentInfo: res.paymentInfo,
        paymentInfo_received: paymentInfo_received,
        paymentMethods: res.paymentMethods
      });
      window.scrollTo(0,0);
    }).catch((err) => {
      alert("Error. " + err);
    });
  }
  onPaymentStarted(e) {
    this.setState({paymentStarted: true});
  }
  onChange(e) {
    this.setState({data: e.formData});
  }
  render() {
    if (this.state.hasError) {
      return <div><h1>Unexpected Error</h1><p>There was an error rendering the form. Please try again later.</p><code>{this.state.errorMessage}</code></div>; 
    }
    if (get(this.state.formOptions, "loginRequired") === true && !this.props.auth.loggedIn) {
      return (<div className="text-center">
          <h1 dangerouslySetInnerHTML={{ "__html": DOMPurify.sanitize(this.state.schema.title)}} />
          <h2>Please log in or sign up for a new account.</h2>
          <Login />
      </div>);
    }
    if (this.state.status == STATUS_FORM_PAYMENT_SUCCESS) {
      return (<div>
        <h1>Payment processing</h1>
        <p>Thank you for your payment! You will receive a confirmation email within 24 hours after the payment has been verified.</p>
      </div>);
    }
    if (this.state.status == STATUS_FORM_DONE) {
      return (<div>
        <div dangerouslySetInnerHTML={{ "__html": DOMPurify.sanitize(this.state.schemaMetadata.successMessage || "Thank you for your form submission!") }} />
      </div>);
    }
    if (this.state.status == STATUS_FORM_LOADING || this.props.loading) {
      return (
        <Loading hasError={this.state.hasError} />
      );
    } // else if (this.state.status == STATUS_FORM_RENDERED) {
    // return         <Form
    // schema={this.state.schema}
    // uiSchema={this.state.uiSchema} widgets={widgets} onChange={(e) => {this.onChange(e)}} />;
    let formToReturn = (
      <div className={"ccmt-cff-Page-FormPage " + ((this.state.status == STATUS_FORM_RENDERED) ? "" : "ccmt-cff-Page-FormPage-readonly")} >
        {this.state.formOptions.loginRequired && <Login />}
        <Helmet><title>{htmlToText.fromString(get(this.state.schema, "title", "CFF Form"), {"ignoreImage": true, "ignoreHref": true})}</title></Helmet>
        <CustomForm showPaymentTable={this.state.status == STATUS_FORM_RENDERED || this.state.formOptions.paymentInfo.showPaymentTable === false}
          schema={this.state.schema}
          uiSchema={this.state.uiSchema}
          formData={this.state.data}
          paymentCalcInfo={this.state.paymentCalcInfo}
          onSubmit={e => this.onSubmit(e)}
          onChange={e => this.onChange(e)}
          />
        {this.state.ajaxLoading && <Loading hasError={this.state.hasError} />}
      </div>
    );
    if (this.state.status == STATUS_FORM_CONFIRMATION) {
      return (<div>
          {!this.state.paymentStarted && <div>
            <h1 className="text-center">Confirmation Page</h1>
            <div className="my-4 text-center">
              Please scroll down and review your registration details in order to continue.
            </div>
            {formToReturn}
            <button className="btn btn-default"
              onClick={this.goBackToFormPage}
            >Go back and edit form response</button>
          </div>}
          <FormConfirmationPage
            onPaymentStarted={e => this.onPaymentStarted(e)}
            schema={this.state.schema}
            schemaMetadata={this.state.schemaMetadata}
            paymentInfo={this.state.paymentInfo}
            paymentInfo_received={this.state.paymentInfo_received}
            paymentMethods={this.state.paymentMethods}
            uiSchema={this.state.uiSchema}
            data={this.state.data}
            goBack={this.goBackToFormPage}
            responseId={this.state.responseId}
            formId={this.props.formId}
            onPaymentComplete={(e) => this.onPaymentComplete(e)}
          />
        </div>);
    }
    return formToReturn;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(FormPage);